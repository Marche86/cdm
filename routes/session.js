"use strict";

var ipaddr = require('ipaddr.js');
var util = require("util");
var Promise = require('bluebird');
var uuid = require('node-uuid');
var _ = require('underscore');

var db = require('../models');
var config = require("../config/config.json");
var ExcepcionCDM = require('../modulos/ExcepcionCDM.js');

const SALTO_CLAVE = "SAOQS";

var sha1 = require('sha1');

/**
 * Registra el ingreso del usuario al sistema.
 * 
 * @param {Object}
 *            usuario Usuario
 * @param {String}
 *            ip Dirección IP desde la cual se ingresa al sistema
 * @param {String}
 *            useragent Programa con el cual se ingresa
 */
function asentarIngreso(usuario, ip, useragent) {
	return db.Ingreso.create({
		resultado: 'EXITO',
		ip: db.sequelize.fn('inet_aton', ip),
		useragent: useragent,
		UserId: usuario.id,
	});
}

/**
 * Crea una sesion para el usuario
 * 
 * @param {Object}
 *            Usuario
 * @returns {Promise}
 */
function crearSesion(usuario) {
	return db.Sesion.create({
		suid: uuid.v4(),
		UserId: usuario.id
	}, { include: [{ model: db.User }] })
		.then(function (sesion) {
			// TODO Sacar esto cuando el ORM sea más inteligente y permita en el
			// create pasarle el objeto usuario y que lo mantenga
			sesion.User = usuario;
			return sesion;
		});
}

/**
 * Obtiene un usuario en caso de que exista y la clave sea la correcta
 * 
 * @param {String}
 *            nombre Nombre del usuario
 * @param {String}
 *            clave Contraseña del usuario
 * @returns {Promise} Promesa de devolución del usuario
 */
function obtenerUsuario(nombre, clave) {
	return db.User.find({
		where: {
			usuario: nombre
		},
		include: [{
			model: db.Permiso
		}]
	});
}

/**
 * 
 * @param {String}
 *            useragent Identificador unico del sotware y su version
 * @param {String}
 *            hash Checksum del programa
 * @returns {Promise} Promesa que devolverá True si el Editor es válido o false
 *          en caso contrario
 */
function validarEditor(useragent, hash) {
	if (config.general.validarEditor) {
		return db.Editor.find({
			where: {
				version: useragent,
				hash: hash
			}
		}).then(function (editor) {
			if (editor) return true;
			return false;
		});
	} else {
		return Promise.resolve(true);
	}
}

/**
 * Crea una sessión para el usuario, otorgando un token con el cual podrá
 * acceder a las distintas funcionalidades
 * 
 * @param {Object}
 *            [datos] Información de inicio de sesion.
 * @param {String}
 *            [datos.usuario] Nombre del usuario
 * @param {String}
 *            [datos.clave] Contraseña del usuario
 * @param {String}
 *            [datos.useragent] Dispositivo desde donde el usuario quiere inciar
 *            sesion
 * @param {String}
 *            [datos.ip] Dirección IP
 * @returns {Promise} Promesa que entregará un objeto Sesion.
 */
function iniciarSesion(datos) {

	var _scope = [];

	return validarEditor(datos.useragent, datos.hash).then(function (valido) {

		if (!valido) throw new ExcepcionCDM("Programa obsoleto. Consiga una version actualizada.", 400);

		return obtenerUsuario(datos.usuario);
	}).then(function (usuario) {
		if (!usuario) throw new ExcepcionCDM("Usuario inexistente o clave incorrecta.", 400);
		if (usuario.clave !== datos.clave) throw new ExcepcionCDM("Usuario inexistente o clave incorrecta.", 400);
		if (usuario.habilitado === 'NO') throw new ExcepcionCDM("El usuario se encuentra deshabilitado.", 400);
		_scope.usuario = usuario;
		return crearSesion(usuario);
	}).then(function (sesion) {
		_scope.sesion = sesion;
		return asentarIngreso(_scope.usuario, datos.ip, datos.useragent);
	}).then(function (ingreso) {
		return _scope.sesion;
	});

};

/**
 * Inicia la sesión un usuario
 */
exports.iniciarSesion = function (req, res) {
	// TODO ASERTS
	var infoAgent = req.headers['user-agent'].split("/");
	var useragent = infoAgent[0] + "/" + infoAgent[1] + "/" + infoAgent[2];
	var hash = infoAgent[4];
	var ipOriginal = ipaddr.process(req.ip).toString();
	var ipv4 = '';

	if (ipaddr.IPv4.isValid(ipOriginal)) {
		ipv4 = ipOriginal;
	} else if (ipaddr.IPv6.isValid(ipOriginal)) {
		var ipv6 = ipaddr.IPv6.parse(ipOriginal);
		if (ipv6.isIPv4MappedAddress()) {
			ipv4 = ipv6.toIPv4Address().toString();
		} else {
			ipv4 = '0.0.0.0';
		}
	} else {
		ipv4 = '0.0.0.0';
	}

	var datos = {
		usuario: req.body.usuario,
		clave: sha1(req.body.clave + req.body.usuario.toUpperCase() + SALTO_CLAVE),
		useragent: useragent,
		ip: ipv4,
		hash: hash,
	};

	iniciarSesion(datos).then(function (sesion) {
		var permisosData;
		var info;

		// Formatemos los permisos
		permisosData = _.reduce(sesion.User.Permisos, function (permisosData, permiso) {
			permisosData[permiso.nombre] = permiso.acceso;
			return permisosData;
		}, {});

		info = {
			token: sesion.suid,
			id: sesion.User.id,
			nombre: sesion.User.usuario,
			correo: sesion.User.correo,
			persona_nombre: sesion.User.nombre + " " + sesion.User.apellido,
			permisos: permisosData,
		};

		res.status(200).send(JSON.stringify(info));
	}).catch(ExcepcionCDM, function (error) {
		res.status(error.numero).send({ mensaje: error.mensaje });
	}).catch(function (error) {
		logger.error(error);
		res.status(500).send({ mensaje: "En estos momentos no es posible ingresar, intente más tarde." });
	});
};

/**
 * Mantiene activa la sesion del usuario
 */
exports.keepAlive = function (req, res) {
	// Respondo rapido
	res.status(200).send();
	// Aumento al cantidad de KeepsActivos
	req.sesion.keepsActivos = req.sesion.keepsActivos + 1;
	// Guardo
	req.sesion.save().catch(function (error) {
		logger.error(error);
	});
}

/**
 * Cierra la sesion del usuario
 */
exports.cerrarSesion = function (req, res) {
	// Cerramos la sesion
	req.sesion.cerrar().then(function (sesion_antigua) {
		return req.sesion.destroy();
	}).then(function () {
		req.sesion = null;
		res.sendStatus(200);
	}).catch(function (error) {
		res.sendStatus(500);
	});
}

exports.validarSesion = function (req, res, next) {

	if (!req.session.uid) {
		res.status(401).send(); // No le decimos nada, ¿porque no mando el token?
		return;
	}

	db.Sesion.find({
		where: {
			suid: req.session.uid
		},
		include: [{
			model: db.User,
			as: 'User'
		}]
	}).then(function (sesion) {

		// ¿Esta ok?
		if (sesion && sesion.User) {
			req.usuario = sesion.User;
			req.sesion = sesion;

			// Actualizamos la fecha de ultima vez accedido
			return req.sesion.save();
		}

		throw { status: 401, mensaje: "Se ha cerrado la sessión. Por favor re ingrese." };

	}).then(function () {
		// Continuamos
		next();
	}).catch(function (error) {
		// Devolvemos el error
		if (error.status) {
			res.status(error.status).send({ mensaje: error.mensaje });
		} else {
			res.status(500).send();
		}
	});

};

/**
 * Cierra todas las sesiones inactivas.
 */
exports.cerrarSesiones = function () {
	logger.info("Cerrando Sesiones");
	// Obtengo todas las Sesiones cuya fecha de actualizacion
	// sea 2 minutos menor a la fecha actual.
	// para luego cerrarlas las cierro.
	db.Sesion
		.findAll({
			where: {
				fechaActualizada: {
					lt: new Date(new Date() - 120 * 60 * 1000)
				}
			},
			include: [{
				model: db.User,
				as: 'User'
			}]
		})
		.then(function (sesiones) {
			// Ceramos las sesiones
			return Promise.all(sesiones.map(
				function (sesion) {
					return sesion.cerrar()
						.then(function (sesion_antigua) {
							return sesion.destroy();
						})
				}));
		})
		.catch(
		function (error) {
			logger
				.info("Se produjo un error al cerrar las sesiones. Error: "
				+ error);
		});
};
