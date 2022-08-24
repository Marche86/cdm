"use strict";
var jade = require("jade");
var path = require("path");
var os = require('os');
var Promise = require('bluebird');
var _ = require("underscore");

var Mail = require("./Mail.js");
var Cadena = require('../modulos/Cadena.js');
var DeployIndicaciones = require('../modulos/DeployIndicaciones.js');
var util = require('util');
var db = require('../models');
var ExcepcionCDM = require('../modulos/ExcepcionCDM.js');
var moment = require('moment');


/**
 * 
 * @param nombreTemplate
 * @param datos
 * @param destinatarios
 */
function enviarCorreo(nombreTemplate, titulo, info, destinatarios) {
	try {
		// Cargamos el template
		var template = jade.compileFile('./mail_templates/' + nombreTemplate + ".jade", { globals: ['moment']});  
	} catch(error) {
		logger.error("No se pudo cargar el tempalte");
		logger.error(error);
		return;
	}
	
    var mail = new Mail();
     
    for (let i = 0; i < destinatarios.length; ++i) {
    	console.log(template({info : info, destinatario : destinatarios[0]}));
    	mail.enviar(destinatarios[i].mail, titulo, template({info : info, destinatario : destinatarios[i]}));
    }
}

/**
 * 
 * @param {Number}
 *            repositorioId Identificador unico del repositorio
 * @param {Number}
 *            commitId
 * @returns
 */
function obtenerInformacion_NuevaContenido(repositorioId, commitId) {
	
	var scope = { repositorio : null, commit : null, usuarios : null};
	
	return Promise.props({
							repositorio : db.Repositorio.findById(repositorioId),
							commit : db.Commit.findById(commitId, { include : [ 
							                                                    { model : db.User } ,
							                                                    { model : db.CommitArchivo, separate : true}
																			  ]
																  }), 
			}).then(function(informacion) {
				scope.repositorio = informacion.repositorio,
				scope.commit = informacion.commit
				
				return scope.repositorio.getUsers({ where : 
				{
					mail : { ne : null },
					habilitado : "SI",
				}, raw : true});
			}).then(function(usuarios) {
				scope.usuarios = usuarios;
				
				console.log(usuarios);
				return scope;
			});
}

/**
 * Recopila la informacion necesaria para el evento NuevaActualizacion de
 * ambienteId y deployId
 * 
 */
function obtenerInformacion_NuevaActualizacion(ambienteId, deployId) {
	
	var _scope = {};
	
	// Obtengo el Ambiente
	// Obtengo el deploy junto con la informacion de los elementos y los deployelementos.
	
	
	// Obtengo el ambiente junto al ultimo deploy y al usuario
	return db.Ambiente.findById(ambienteId, { 
										include : [ 
										            { model : db.Deploy, as : "deployActual", include : 
										            					[ { model : db.User, attributes : ['usuario'] } ] }
												  ]
	
	}).then(function(ambiente) {
		_scope.ambiente = ambiente;
		// Obtengo todos los deploy elementos involucrados
		return ambiente.deployActual.getDeployElementos({attributes : ['elemento', 'subelementos', 'version'], raw : true})		
	}).then(function(rawDeployElementos)  {
		
		// Como estoy obteniendo el raw y no el objeto, tengo que transformar
		// las indicaciones
		// de un json a un objeto
		try {
			_scope.rawDeployElementos = rawDeployElementos.map(function(elemento) {
																	elemento.subelementos = JSON.parse(elemento.subelementos);
																	elemento.elemento = Elementos.obtenerElemento(elemento.elemento).humano;
																	return elemento;
																});
		} catch (e) {
			logger.error("Error al parsear rawDeployElementos", e);
			throw ExcepcionCDM(500, "No se pudo enviar las alertas.");
		};
		
		// Obtengo todas las versiones (commits) involucradas
		var commits_versiones = _.chain(rawDeployElementos)
								  .uniq(false, function(elemento) { 
									  	return elemento.version; 
								  })
								  .pluck('version')
								  .value();
		
		// Obtengo todos los commits realmente
		return db.Commit.findAll({ 
										attributes : ['version', 'comentario', 'fecha_creado'],
										where : { 	version : commits_versiones, 
												 	RepositorioId : _scope.ambiente.RepositorioId
												},
										include : [ { model : db.User, attributes : ['usuario'] }],
										raw : true,
										order : [ ['version', 'asc'] ],
								 });
	}).then(function(rawCommits) {
		_scope.rawCommits = rawCommits; 
		// Obtenemos el repo, pero sobre todo los usuarios que tienen acceso a
		// el
		return db.User.findAll({ where : 
			{
				mail : { ne : null },
				habilitado : "SI",
			},
			attributes : ['usuario', 'mail'],
			raw: true,
			include : [ { model : db.Repositorio,attributes : [],required : true,  through: { 
															attributes : { include : [] }, 
															where : { RepositorioId : _scope.ambiente.RepositorioId} 
															}}]
			});
	}).then(function(rawUsuariosRepositorio) {
				
		// TODO, esto lo hago por un bug en el through.attributes de la
		// sentencia superior
		let destinatarios = rawUsuariosRepositorio.map(function(usuario) {
			return {
				usuario : usuario.usuario,
				mail : usuario.mail
		}});
		
		let indicaciones = _.reduce(_scope.ambiente.deployActual.indicaciones, function(acumulado, argumentoIndicacion, tipoIndicacion) {
				var indicacion = DeployIndicaciones.obtenerIndicacion(tipoIndicacion);
				
				if (!indicacion) return acumulado;
				
				if (!indicacion.activada(argumentoIndicacion)) return acumulado;
				
				acumulado.push(indicacion.info(argumentoIndicacion));
				
				return acumulado;
		}, []);
		
		let campos = { 		nombre : _scope.ambiente.nombre, 
							deployActual : {
								version : _scope.ambiente.deployActual.version,
								usuario : _scope.ambiente.deployActual.User.usuario,
								fechaProgramada : _scope.ambiente.deployActual.fechaProgramada,
								comentario : _scope.ambiente.deployActual.comentario,
								indicaciones : indicaciones,
								commitUtilizados : _scope.rawCommits,
								deployElementos : _scope.rawDeployElementos,
							}
					};
		
		return { campos : campos, destinatarios : destinatarios };

	});
	
}

/**
 * Envía a todos los usuarios que tienen acceso a este Ambiente un Alerta que se
 * creó una nueva actualizacion
 * 
 * @param {Number}
 *            ambienteId Identificador unico del ambiente
 * @param {Number}
 *            deployId Identificador unico del deploy que es la actualización
 *            que se genero para este ambiente
 */
function nueva_actualizacion(ambienteId, deployId) {	
	obtenerInformacion_NuevaActualizacion(ambienteId, deployId)
			
	.then(function(informacion) {
	    let titulo =  Cadena.capitalize(informacion.campos.deployActual.usuario) + ' programó una nueva actualización en ' + informacion.campos.nombre + ' que se implantará '  + moment(informacion.campos.deployActual.fechaProgramada).fromNow() + '.';
	    
		enviarCorreo("nueva_actualizacion", titulo, informacion.campos, informacion.destinatarios);
	}).catch(function(error) {
		logger.error("Error al obtener la informacion para envio de nueva actualizacion.", error);
	});
};

/**
 * 
 * @param {Number}
 *            repositorio Identificador unico que recibio nuevo contenido
 * @param {commitId}
 *            commitId identificador unico del nuevo contenido
 * @returns
 */
function nuevo_contenido(repositorioId, commitId) {
    	
	/**
	 * Obtengo el repositorio Obtengo el commit y los archivos relacionados
	 * Obtengo los usuarios que acceden al repositorio.
	 */
	obtenerInformacion_NuevaContenido(repositorioId, commitId)
	.then(function(informacion) {
	    let titulo = '[' + informacion.repositorio.nombre + " Versión " + informacion.commit.version + "] " + Cadena.capitalize(informacion.commit.User.usuario) + " compartió novedades.";

	    enviarCorreo("nuevo_contenido", titulo, informacion, informacion.usuarios);
	}).catch(function(error) {
		logger.error("Error al obtener la informacion para envio de nueva actualizacion.", error);
	});   
}

module.exports.nuevo_contenido = nuevo_contenido;
module.exports.nueva_actualizacion = nueva_actualizacion;