"use strict";
var db = require('../models');
var util = require('util');
var Promise = require('bluebird');
var fs = require("fs-extra");

var Config = require('../config/config.json').general;
var Alertas = require('../modulos/Alertas.js');
var Fecha = require('../modulos/Fecha.js');
var Errores = require('./errores.js');

var ExcepcionCDM = require('../modulos/ExcepcionCDM.js');

/**
 * 
 * @param {db.Repositorio}
 *            repositorio
 * @param {db.Commit}
 *            commit
 * @param {db.CommitArchivo}
 *            commitArchivo
 * @return {String}
 */
function generarLinkArchivo(repositorio, commit, commitArchivo) {
	return (Config.dominio + '/repositorios/' + repositorio.nombre + '/' + commit.version + '/' + commitArchivo.nombre);
}

/**
 * 
 */
function formatearInfoNovedades(repositorio, commits) {
	let novedades = [];
	let archivo;
	let archivos;

	// Recorremos todos los commits y todos los archivos
	for (let i = 0; i < commits.length; ++i) {

	    let commit = commits[i];
	    archivos = commit.CommitArchivos;

	    for (let j = 0; j < archivos.length; ++j) {

		archivo = archivos[j];

		novedades
			.push({
			    ubicacion : generarLinkArchivo(repositorio, commit, archivo),
			    destino : archivo.destino,
			    version : commit.version,
			    tamano : archivo.tamano,
			    headers : archivo.headers
			});
	    }
	}
	
	return novedades;
}

/**
 * 
 * @param {Array.
 *            <db.Commit>}
 */
function formatarInfoCommits(commits) {
	var novedades = [];

	for (let i = 0; i < commits.length; ++i) {
	    let commit = commits[i];
	    
	    novedades.push({
	    	numero : commit.version,
	    	fecha : commit.fecha_creado,
	    	comentario : commit.comentario,
	    	usuario : commit.User.usuario
	    })
	}
	
	return novedades;
}

/**
 * Comando UNLOCK. Desbloquea el repositorio cambiando su estado de CERRADO a
 * ABIERTO
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros en la URL
 * @param {String}
 *            [req.params.repo] Nombre del repositorio
 */
exports.unlock = function(req, res) {
    var nombreRepo = req.params.repo;
    
    db.sequelize.transaction(function(t) {
    	return db.Repositorio.getForUpdate(t, nombreRepo)
    		.then(function(repositorio) {
    			if (!repositorio) throw new ExcepcionCDM("El repositorio no existe.", 410);
    			
    			return repositorio.unlock(t);
    		});
    }).then(function() {
    	res.status(200).send();
    }).catch(ExcepcionCDM, function(e) {
    	res.status(e.numero).send({mensaje : e.mensaje});
    }).catch(function(e) {
    	logger.error("Error al iniciar nuevo contenido en el repositorio", e);
    	res.status(500).send({mensaje : "En estos momentos no es posible realizar la accion"});
    });
    
};

/**
 * 
 */
exports.descargarArchivo = function(req, res) {
	// ¿El archivo existe?
	
	// TODO Agregar Seguridad
	var archivo = process.cwd() + Config.conestatico + "/repositorios/" + req.params.repo + "/" + req.params.version + "/" + req.params.archivo;
	
	var stats = fs.stat(archivo, function(err, stats) {
		if (!err && stats.isFile()) {
			res.download(archivo); // Forzamos a que se descargue como archivo
		} else {
			res.status(204).send({mensaje : "El archivo que se desea descargar no esta disponible"});
		}    
	});
}

/**
 * Comando INFO. Obtiene informacion del repositorio
 * 
 */
exports.info = function(req, res) {
	
	req.repositorio.getUltimoCommit({include : [{ model : db.User }],
									 raw : true})
		
			.then(function(ultimoCommit) {
				res.status(200).send({
					version : ultimoCommit.version,
					fecha : req.repositorio.updatedAt,
					usuario : ultimoCommit['User.usuario']				
				});
    });
		 
};

/**
 * 
 */
exports.cargarRepositorio = function(req, res, next) {
    var nombreRepo = req.params.repo;

    db.Repositorio.find({
    	where : {
    		nombre : nombreRepo
    	}
    }).then(function(repositorio) {
    	if (!repositorio) throw new ExcepcionCDM('Repositorio inexistente.', 404);
    	
    	req.repositorio = repositorio;
    	next();
    }).catch(ExcepcionCDM, function(error) {
    	res.status(error.numero).send({mensaje : error.mensaje});
    }).catch(function(e) {
    	logger.error("Cargar repositorio. Error repositorio:", e);
    	res.status(500).send({mensaje : "En estos momentos no es posible cargar el repositorio."});
    });
};



/**
 * Comando LOG. Obtiene las novedades del repositorio a partir de la version
 * indicada
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros en la URL
 * @param {String}
 *            [req.params.repo] Nombre del repositorio
 * @param {Object}
 *            [req.params.version} Numero de la version a partir de la cual se
 *            quiere consultar
 */
exports.log = function(req, res) {
    var nombreRepo = req.params.repo;
    var miversion = req.params.version;

    
    // ¿Algo nuevo?
    if (req.repositorio.version <= miversion) {
    	res.status(200).send([]);
    	return;
    }
    
    // Obtengo todos los commits para este repositorio mayores a la version
    // que tiene el usuario
    req.repositorio.getCommits({
		where : {
		    version : {
		    	gt : miversion,
		    }, 
		    id : {
		    	lte : req.repositorio.ultimoCommitId, //TODO Mejorar esta referencia
		    },
		},
		order : 'id asc',
		include : [ {
		    model : db.User,
		} ]
    }).then(function enviarNovedades(commits) {
    	let novedades  = formatarInfoCommits(commits);
    	res.status(200).send(novedades);    	
    }).catch(function(error) {
    	logger.error("Obtener novedades. ", error);
    	res.status(500).send({ mensaje : "En estos momentos no es posible obtener novedades."});
    });

};

/**
 * Comando UPDATE. Se respondera con todos los archivos y su informacion
 * adicional que componen todas las novedades del repositorio desde la version
 * indicada
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros en la URL
 * @param {String}
 *            [req.params.repo] Nombre del repositorio
 * @param {Number}
 *            [req.params.version} Version desde la cual se quiere actualizar
 */
exports.update = function(req, res) {
    var nombreRepo = req.params.repo;
    var miversion = req.params.version;

    /*
	 * Obtengo todos los Commits (con los archivos relacionados) a partir de la
	 * version indicada Formateo la informacion y se la envio.
	 */
    req.repositorio.getCommits({
		where : {
		    version : {
		    	gt : miversion
		    },
		    id : {
		    	lte : req.repositorio.ultimoCommitId,
		    }
		},
		order : 'id asc',
		include : [ {
		    model : db.CommitArchivo, separate : true
		}]
	}).then(function enviarInfoArchivos(commits) {
		let novedades = formatearInfoNovedades(req.repositorio, commits);
		// Enviamos
		res.status(200).send(novedades);
    }).catch(ExcepcionCDM, function(e) {
    	res.status(e.numero).send({mensaje : e.mensaje});
	}).catch(function(error) {
		logger.error("Comando UPDATE. Error al obtener recursos:", error);
		res.status(500).send({ mensaje : "En estos momentos no es posible ejecutar el proceso de actualiacion."});
	});
};

/**
 * 
 * Sistema de agregado de novedades
 * 
 * Funciona en 3 partes. - Comando BEGIN: cominza el proceso de compartir, se
 * hacen los preparativos previos bloqueandose el repositorio para que otro
 * usuario no pueda iniciar otro proceso de compartir hasta que no se termine el
 * actual - Comando UPLOAD: Se ejecuta un comando por cada archivo que forma
 * parte de las novedades. - Comando END. El usuario ya subio todas las
 * novedades.
 * 
 */


/**
 * Primera funcion a ejecutar en el ciclo de Commit. Se bloquea el repositorio
 * dejandolo en estado CERRADO, y crea el commit correspondiente, almacenando el
 * usuario que lo creó, el comentario para luego llenarlo con los archivos
 * correspondientes
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros en la URL
 * @param {String}
 *            [req.params.repo] Nombre del repositorio
 * @param {Object}
 *            [req.body] Informacion basica del nuevo cotenido
 * @param {String}
 *            [req.body.comentario] Descripcion del nuevo contenido
 */
exports.commit_begin = function(req, res) {
    // Chequeamos
    req.checkBody('comentario', 'Tenes que ingresar el comentario').isLength( { min: 10} );
    
    var errores = req.validationErrors();
    if (errores) {
    	Errores.enviarErrorParametros(res, req,  errores);
        return;
    }
    /**
	 * Obtenemos una transaccion. Obtenemos el repositorio para ser modificado.
	 */
    db.sequelize.transaction(function(t) {
    	return db.Repositorio.getForUpdate(t, req.params.repo)
    		.then(function(repositorio) {
    			if (!repositorio) throw ExcepcionCDM("El repositorio no exsite.", 410);
    			
    			return repositorio.iniciarNuevoCommit(t, req.usuario, req.body.comentario);
    		});
    }).then(function() {
    	res.status(200).send();
    }).catch(ExcepcionCDM, function(e) {
    	res.status(e.numero).send({mensaje : e.mensaje});
    }).catch(function(e) {
    	logger.error("Error al iniciar nuevo contenido en el repositorio", e);
    	res.status(500).send({mensaje : "En estos momentos no es posible realizar la accion"});
    });
};

/**
 * Por cada archivo que el usuario suba se hace una petición a esta funcion S
 * 
 * @param {Object}
 *            [req] Objeto de express con la información de la request
 * @param {Object}
 *            [req.params] Parametros en la URL
 * @param {String}
 *            [req.params.repo] Nombre del repositorio
 * @param {Object}
 *            [req.body] Informacion basica del nuevo cotenido
 * @param {String}
 *            [req.body.cambios] Formato JSON. Lista de cambios que contiene
 *            este archivo.
 * @param {String}
 *            [req.body.headers] Formato JSON. Opciones especiales para este
 *            archivo.
 * @param {String}
 *            [req.body.origen] Tipo de elemento compartido
 */
exports.commit_upload = function(req, res) {
    var nombreRepo = req.params.repo;
    var cambios = req.body.cambios || "";
    var headers = req.body.headers || "";
    var origen = req.body.origen;
    
    // TODO Chequear parametros
    var datos = {
    		usuario : req.usuario,
    		cambios : cambios,
    		headers : headers,
    		archivo : req.file,
    		origen : origen
    };
    
    db.sequelize.transaction(function(t) {
    	return db.Repositorio.getForUpdate(t, nombreRepo)
    		.then(function(repositorio) {
    			if (!repositorio) throw ExcepcionCDM("El repositorio no exsite.", 410);
    			return repositorio.agregarContenidoNuevoCommit(t, datos);
    		});
    }).then(function(repositorio) {
    	res.status(200).send();
    }).catch(ExcepcionCDM, function(e) {
    	res.status(e.numero).send({mensaje : e.mensaje});
    }).catch(function(e) {
    	logger.error("Error al iniciar nuevo contenido en el repositorio", e);
    	res.status(500).send({mensaje : "En estos momentos no es posible realizar la accion"});
    });
};


/**
 * Una vez que se subieron todos los archivos se ejecuta esta función. Se
 * verifica que el repositorio este cerrado y que haya sido el usuario quien lo
 * cerro. Obtengo todos los archivos del commit, para recorrer los cambios que
 * contiene el archivo y actualizar el estado de los recursos. Se cambia el
 * nombre de la carpeta de "TEMP" al número de versión. Se actualiza el
 * repositorio y se libera el candado.
 * 
 * @return El número número de versión del repositorio
 */
exports.commit_end = function(req, res) {
    var nombreRepo = req.params.repo;
    
    db.sequelize.transaction(function(t) {
    	return db.Repositorio.getForUpdate(t, nombreRepo)
    		.then(function(repositorio) {
    			if (!repositorio) throw ExcepcionCDM("El repositorio no existe.", 410);
    			return repositorio.finalizarNuevoCommit(t);
    		});
    }).then(function(repositorio) {
    	// Avisamos!
    	res.status(200).send({version : repositorio.ultimoCommit.version});
    	// Alertamos!
    	Alertas.nuevo_contenido(repositorio.id, repositorio.ultimoCommitId);
    }).catch(ExcepcionCDM, function(e) {
    	res.status(e.numero).send({mensaje : e.mensaje});
    }).catch(function(e) {
    	logger.error("Error al iniciar CERRAR contenido en el repositorio", e);
    	res.status(500).send({mensaje : "En estos momentos no es posible realizar la accion"});
    });
};