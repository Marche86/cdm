"use strict";

var Promise = require('bluebird');
var util = require('util');
var _ = require("underscore");

var Alertas = require('../modulos/Alertas.js');

var db = require('../models');
var ExcepcionCDM = require('../modulos/ExcepcionCDM.js');
var Fecha = require('../modulos/Fecha.js');

/**
 * 
 * @param {Object.
 *            <String, (Number|Array.Number)>} [elementos] Elementos que se
 *            quieren compartir. En caso de ser un elemento con subelementos, el
 *            valor del hash será un array de array de numeros, en la primer
 *            posicion se encontrará el identificador del subelementos y en la
 *            segunda la versión a la cual se quiere actualizar el subelemento
 * 
 * @return {Array.<{elemento: String, version: Number, subelementos: String}>
 *         Un array que indica por cadaelemento/version que subelementos de este
 *         debe implantar o todo el elemento en su versión en caso de no tener
 *         subelementos
 */
function formatearListaElementos(elementos) {
   return _.reduce(elementos, function(infoDeploys, info, elemento) {
       // ¿Tiene sub elementos?
       if (!isNaN(info)) {
           let registroDeploy = {elemento : elemento, version : info, subelementos : "[]" };

           infoDeploys.push(registroDeploy);
       } else {
           // Agrupo los elementos por la versión a la cual pertenece
           let agrupados = _.reduce(info, function(agrupados, registro) {
                               let version = registro[1];
                               if (!(version in agrupados)) {
                                   agrupados[version] = [];
                               }
                               agrupados[version].push(registro[0]);
                               return agrupados;
                           }, {});

           // Creo un registro de deploy por cada versión
           let registrosDeploys =  _.map(agrupados, function(subelementos, version) {
               return {
                       elemento : elemento,
                       version : version,
                       subelementos : JSON.stringify(subelementos),
                       };
           });

           // Guardo
           infoDeploys = infoDeploys.concat(registrosDeploys);
       }
       return infoDeploys;
   }, []);
}

/**
 * Devuelve un Objeto Ambiente con la información basica del Repositorio y el
 * ultimo deploy
 * 
 * @param {String}
 *            nombre Nombre identificatorio del ambiente
 * @returns {Promise<Ambiente>} Ambiente
 */
function obtenerAmbienteInfoBasica(nombre) {
	return db.Ambiente.find({
		where : {
			nombre : nombre
		},
		include :  [ 
		            { 
		            	model: db.Repositorio,
						include : [{model : db.Commit, as : "ultimoCommit",
									include : [ { model : db.User}] }]
					} , { 
						model: db.Deploy, 
						include : [{model : db.User }],
						as : "deployActual"
						}
					]
	});
}


/**
 * Retorna el Ambiente indicado con la pre-carga de toda la informacion del
 * Repositorio de la ultima versión del Ambiente y de todos los Deploy
 * realizados
 * 
 * @param {String}
 *            nombre Nombre identificatorio del ambiente
 * @returns {Promise<Ambiente>}
 */
function obtenerAmbienteFull(nombre) {	
	return db.Ambiente.find({
		where : {
			nombre : nombre
		},
		include : [ { model : db.Repositorio ,
						include : [ { model : db.Commit,
									  separate : true,
									  include : [ {  model : db.CommitArchivo,
										  			separate : true,
										  			include : { all : true }}   ]} ] },
		           {	model: db.Deploy,
						separate : true,
						include:  [ { separte : true, model :  db.DeployElemento } ]
				   },
				   { 	
					   	model : db.Deploy,
					   	as : "deployActual",
					   	include : [ { model : db.User}]
				   }
				   ]
	});
}


/**
 * Crea un Deploy
 * 
 * @param {String}
 *            nombreAmbiente Nombre del ambiente sobre el cual se quiere crear
 *            la actualizacion
 * @param {String}
 *            comentario Objetivo de está actualizacion
 * @param {Date}
 *            fechaProgramada Fecha en la ue se debe implantar esta
 *            actualizacion
 * @param {Object}
 *            [indicaciones] Indicaciones que serán teniedas en cuenta al
 *            momento de la implantacion
 * @param {Boolean}
 *            [indicaciones.forzarReinicio=false] El servidor se debe reiniciar
 *            independientemente de ser necesario.
 * @param {Boolean}
 *            [indicaciones.noIniciar=false] Luego de implantada la
 *            actualización el servidor no se inicia automaticamente.
 * @param {String}
 *            [indicacions.mensajeCierre=""] Cuando el servidor le avisa a los
 *            usuarios que en X minutos se reiniciará se agrega al final este
 *            texto.
 * @param {Object.
 *            <String, (Number|Array.Number)>} [elementos] Elementos que se
 *            quieren compartir. En caso de ser un elemento con subelementos, el
 *            valor del hash será un array de array de numeros, en la primer
 *            posicion se encontrará el identificador del subelementos y en la
 *            segunda la versión a la cual se quiere actualizar el subelemento
 * 
 * @return {Promise} Una promesa de entregar el número de la version creada.
 */
function _crearActualizacion(datos, nombreAmbiente) {	
	return db.sequelize.transaction(function (transaccion) {
		// Todo esto se ejecuta bajo una transaccion
		return db.Ambiente.getForUpdate(transaccion, nombreAmbiente, [{
			model : db.Deploy,
			as : "deployActual"
		}])
		.then(function(ambiente) {
			if (!ambiente) throw new ExcepcionCDM("Ambiente inexistente", 410);
			return ambiente.crearActualizacion(transaccion, datos);
		});
	}).then(function(ambiente) {
		// Informamos
		Alertas.nueva_actualizacion(ambiente.id, ambiente.deployActualId);
		return ambiente.deployActual.version;
	}).catch(function(error) {
		throw error;
	});
}

/**
 * Responde con la información basica del Ambiente
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros
 * @param {Object}
 *            [req.params.ambiente] Nombre identificatorio del ambiente
 */
exports.infoAmbiente = function(req, res) {

	var nombre = req.params.ambiente;
    
    logger.info("Info Ambiente. Usuario " + req.usuario.usuario + ". Ambiente: " + nombre);
        
    obtenerAmbienteInfoBasica(nombre).then(function(ambiente) {
		if (!ambiente) throw {mensaje: "Ambiente inexistente"};
				
		let info = {
						nombre : ambiente.nombre,
						estado : ambiente.estado,
						version : { 
							numero  : ambiente.deployActual.version,
							comentario : ambiente.deployActual.comentario,
							fecha : ambiente.deployActual.fecha_creado,
							usuario: ambiente.deployActual.User.usuario,
						}, 
						repositorio : { 
							nombre :  ambiente.Repositorio.nombre,
							version: ambiente.Repositorio.version,
							fecha : ambiente.Repositorio.updatedAt,
							usuario : ambiente.Repositorio.ultimoCommit.usuario,
						}
					};
		
		res.status(200).send(info);
	}).catch(ExcepcionCDM, function (error) {
		res.status(error.numero).send({mensaje : error.mensaje});
	}).catch(function(error) {
		if (error.mensaje) {
			res.status(500).send({mensaje : error.mensaje});
		} else {
			console.log(error);
			res.status(500).send({mensaje : "Error interno en el Cebrero de Mono"});
			logger.error("Informacion de ambiente. Error al obtener la informacion: " + JSON.stringify(error));
		}
	});
}


/**
 * Responde con los elementos del ambiente que aún no fueron implantados y
 * pueden serlo
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros
 * @param {Object}
 *            [req.params.ambiente] Nombre identificatorio del ambiente
 */
exports.obtenerElementosDisponibles = function(req, res) {
	var nombreAmbiente = req.params.ambiente;
	
	obtenerAmbienteFull(nombreAmbiente).then(function(ambiente) {			
		if (!ambiente) throw new ExcepcionCDM("Ambiente inexistente", 410);

		let disponibles =  ambiente.getElementosDisponibles();

		let resultado = {	ultima :  {
								version : ambiente.deployActual.version,
								comentario : ambiente.deployActual.comentario,
								fecha : ambiente.deployActual.createdAt,
								usuario : ambiente.deployActual.User.usuario
							},
							repositorio : {
								version : ambiente.Repositorio.version,
								fecha : ambiente.Repositorio.updatedAt
							},
							disponibles: disponibles
						};
		// Enviamos
		res.status(200).send(resultado);	
	}).catch(ExcepcionCDM, function (error) {
		res.status(error.numero).send({mensaje : error.mensaje});
	}).catch(function(error) {
		logger.error("Obtener elementos disponibles para ambiente: " + nombreAmbiente, error);
		res.status(500).send({mensaje : "Error interno en el Cebrero de Mono. Intente más tarde."});
	});
}

/**
 * Devuelve la informacion basica de todos los Ambientes relacionados a este
 * repositorio
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros
 * @param {Object}
 *            [req.params.repositorio] Nombre identificatorio del repositorio
 */
exports.infoAmbientes = function(req, res) {
	
}

/**
 * Crea una nueva actualización para este Ambiente
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros
 * @param {String}
 *            [req.params.ambiente] Nombre identificatorio del ambiente
 * @param {String}
 *            [req.params.comentario] Comentario sobre el contenido de la
 *            actualizacion
 * @param {Date}
 *            [req.params.fechaprogramada] Fecha en la cual se debe implantar la
 *            actualizacion
 * @param {String}
 *            [req.params.indicaciones] Indicaciones auxiliares para el proceso
 *            de implantación en formato JSON
 * @param {String}
 *            [req.params.elementos] Elementos que forman parte de la
 *            actualizacion en formato JSON
 */
exports.crearDeploy = function(req, res) {
	// TODO chequeos
	var nombreAmbiente = req.params.ambiente;
	
	var comentario = req.body.comentario;
	var fechaProgramada = req.body.fechaprogramada;
	var indicacionesStr = req.body.indicaciones;
	var elementosStr = req.body.elementos;
	var indicaciones;
	var elementos;
	
	// Parametros
	try {
		indicaciones = JSON.parse(indicacionesStr);
		elementos = formatearListaElementos(JSON.parse(elementosStr));
		fechaProgramada = moment.utc(fechaProgramada); // La fecha nos viene en
														// UTF
	} catch (e) {
		logger.warn("Crear Deploy. La informacion recibida no es correcta. ", e);
		res.sendStatus(400, {mensaje : "La información recibida no es correcta."});
		return;
	}
	
	var datos = {
			usuario : req.usuario,
			comentario : comentario,
			fechaProgramada : fechaProgramada,
			indicaciones : indicaciones,
			elementos : elementos
	};
	
	// Creamos
	_crearActualizacion(datos, nombreAmbiente)
	.then(function(version){
		res.status(200).send({version : version});
	}).catch(ExcepcionCDM, function(error) {
		res.status(error.numero).send({mensaje : error.mensaje});
	}).catch(function(error){
		logger.error("Crear Deploy. ", error);
		res.status(500).send({mensaje : "En estos momentos no es posible crear actualizaciones."});
	});
}

/**
 * 
 */
exports.cancelarDeploy = function(req, res) {
}

/**
 * 
 */
exports.obtenerDeploy = function(req, res) {
}