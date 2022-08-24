"use strict";

var _ = require("underscore");
var Promise = require('bluebird');

/**
 * 
 * @param comiteados
 * @param deployados
 * @returns
 */
function obtenerDiferenciaElementos(comiteados, deployados) {
	
	// Agrupamos por Elemento
	var comiteadosElementos = _.groupBy(comiteados, function(registro)  {
									return registro.CommitArchivo.destino;
								});
	
	// Recorremos cada elemento que ya pertenece a una actualizacion
	_.each(deployados, function(deployElemento, index, lista) {
		
		var tipoElemento = deployElemento.elemento;
		var admiteSubElementos = Elementos.obtenerElemento(tipoElemento).admiteSubElementos();
		
		if (!tipoElemento in comiteadosElementos) return;
		
		// Obtenemos todos los registros de este tipo
		var registros = comiteadosElementos[deployElemento.elemento];
		
		// Buscamos la version
		for (var i = registros.length - 1; i > -1; --i) {
			if (registros[i].CommitArchivo.Commit.version <= deployElemento.version) {
				// Mismo tipo de elemento, version inferior o igual a la ya
				// implentada, por lo tanto no me sirve
				// ¿Admite sub elementos?
				if (admiteSubElementos) {
					// Saco de esta versión los Sub Elementos que ya hayan sido
					// depoyados.
					registros[i].subElementos = _.difference(registros[i].subElementos, deployElemento.subelementos);
					// Sino me quedo ningun sub elemento, quito esta version
					// para este Elemento
					if (registros[i].subElementos.length === 0) registros.slice(i,1);
				} else {
					// Saco esta version de este Elemento
					registros.splice(i, 1);
				}
			}
		}
	});
	
	return formatearLista(comiteadosElementos);
}

/**
 * @typedef {Array.<Number>} ElementoSinSubElementos
 * 
 * @typedef {Object} ElementoConSubElementos
 * @property {Number} id Identificador del subelemento
 * @property {String} nombre Nombre del subelemento
 * @property {Array.<Number>} versiones Versiones disponibles para este
 *           subelemento
 * 
 * @param {Object,
 *            <String, [{{CommitArchivo:db.Commit_Archivo,
 *            subelementos:Number[]}[]>]} elementosDisponibles
 * @return {Object.<String, <ElmentoSinSubElementos|ElementoConSubElementos>}
 *         La clave del hash será el tipo de elemento y la clave dependera de si
 *         el elemento admite sub elementos o no comiteadosElementos.
 */
function formatearLista(elementosDisponibles) {	
	
	var resultado =_.reduce(elementosDisponibles, function(resultado, registros, elemento) {
		
		// Ordeno por Version, de mayor a menor.
		
		// Por cada elemento disponible
		if (!Elementos.obtenerElemento(elemento).admiteSubElementos()) {
			// Agrego todas las versiones disponibles para este subElemento
			var versiones = []
			
			for (var i = 0; i < registros.length; ++i) 
				versiones.push(registros[i].CommitArchivo.Commit.version);
			
			resultado[elemento] = versiones;
		} else {
			// Agrego por cada SubElemento las versiones disponibles
			var subElementos = {};
			
			// Por cada Commit
			for (var loopRegistro = 0; loopRegistro < registros.length; ++loopRegistro) {
				
				var registro = registros[loopRegistro];		
				
				
				// Recorro todos los subelementos que tiene este registro
				for (var loopSubElemento = 0; loopSubElemento < registro.subElementos.length; ++loopSubElemento ) {
					
					var idSubElemento = registro.subElementos[loopSubElemento];
					
					// La primera vez
					if (!(idSubElemento in subElementos)) {
						
						// Busco en los cambios del commit este idSubElemento.
						var subElemento = _.find(registro.CommitArchivo.cambios, function(cambio){
							return (cambio.id === idSubElemento);
						});
						
						// Armamos el nombre
						var nombre = (subElemento.nombre || '');

						if (subElemento.accion) nombre+=  " (" + subElemento.accion.substr(0,1) + ")";
						
						// Creamos el objeto con la informacion
						subElementos[idSubElemento] = {id : idSubElemento,
														nombre : nombre,
														versiones : []};
					}
						
					subElementos[idSubElemento].versiones.push(registro.CommitArchivo.Commit.version);
				}
			}	
			
			// Me quedo solamente con los objetos y no con la clave de
			// subElementos que es el idSubElemento
			resultado[elemento] = _.values(subElementos);
		}

		return resultado;		
	}, {});
	
	return resultado;
} 
/**
 * Devuelve un array que contiene los DeployElemento de todos los Deploy pasados
 * por parametro.
 * 
 * @param {Array}
 *            deploys
 * @returns {Array}
 */
function unirDeployElementos(deploys) {
	return deploys.reduce(function(acumulado, deploy) {
			if (deploy.estado === 'ACTIVO') {
				return acumulado.concat(deploy.DeployElementos);
			} else {
				return acumulado;
			}
	},[]);
}

/**
 * A partir de un cojunto de commits devuelve un conjunto de objetos que tendra
 * la misma cantidad de CommitArchivo que hay en total entre todos los commits.
 * Este objeto contien las propiedades CommitArchivo y subElementos, esta
 * ultima propiedad es un array que contiene los identificadores de los
 * subelementos para el Elemento que contiene el CommitArchivo.
 * 
 * @param {Array}
 *            commits
 * @returns {Array}
 */
function reducirCommits(commits) {
	// Creamos un array con la informacion de todos los archivos del commit
	var  reducido = commits.reduce(function(acumulado, commit) {
				return	acumulado.concat(commit.CommitArchivos.map(
									function(archivo) {
									    	var cambios = archivo.cambios;
									    	var subElementos;
									    	
									    	if (!Array.isArray(cambios)) 
									    	    subElementos = [];
									    	else
									    	    subElementos = cambios.map(function(cambio) {if (cambio.id) return cambio.id});
									    	
											return  {
													CommitArchivo : archivo,
													subElementos : subElementos
													}
											}
									));
	}, []);	
	
	return reducido;
}

/**
 * 
 */
Ambiente.prototype.crearDeploy = function(datos, transaccion) {	
	return this.createDeploy({
		comentario : datos.comentario,
		version : this.deployActual.version + 1,
		UserId : datos.usuario.id, 
		fechaProgramada : datos.fechaProgramada, 
		indicaciones : datos.indicaciones,
	}, 
	{
		include : [ { model : this.sequelize.models.User }, { model : this.sequelize.models.Ambiente} ], 
		transaction : transaccion
	});
}

function Ambiente() {
	
	
}
/**
 * 
 */
Ambiente.prototype.crearActualizacion = function(transaccion, datos) {	
	return this.crearDeploy(datos, transaccion).bind(this)
	.then(function(deploy) {
		this.deployActual = deploy;
		return this.setDeployActual(deploy, {save : false});
	}).then(function() {	
		// Le asigno los deploy elements
		var infoDeploys = datos.elementos;
		// Guardamos todos los deploy Elementos
		return Promise.all(infoDeploys.map(function(deploy_elemento) {
			return this.createDeployElemento(deploy_elemento, {transaction : transaccion});
		}.bind(this.deployActual)))
	}).then(function(deployElementos) {
		return this.save({transaction : transaccion});
	}).bind(); // Este bind es para quitarle el this inicial.
}

/**
 * 
 */
Ambiente.prototype.getElementosDisponibles = function() {
	var deployed_elementos = unirDeployElementos(this.Deploys);
	var commit_elementos = reducirCommits(this.Repositorio.Commits);
	
	// Obtenemos los elementos que aun no commitee
	var diferencia = obtenerDiferenciaElementos(commit_elementos, deployed_elementos);
	
	return diferencia;
}

module.exports = Ambiente;