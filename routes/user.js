var db = require('../models');
var tbConfig = require('../config/config.json').tbConfig;
var Fecha = require('../modulos/Fecha.js');
var ExcepcionCDM = require('../modulos/ExcepcionCDM.js');

var sha1 = require('sha1');

const
	SALTO_CLAVE = "SAOQS";

ipfromLong = function fromInt(ipl) {
	return ((ipl >>> 24) + '.' + (ipl >> 16 & 255) + '.' + (ipl >> 8 & 255)
		+ '.' + (ipl & 255));
};


/**
 * 
 * @param {Object}
 *            [datos] Informacion del Usuario a crear
 * @param {String}
 *            [datos.usuario] Nombre que llevara el Usuario
 * @param {String}
 *            [datos.nombre] Nombre de la persona dueña del Usuario
 * @param {String}
 *            [datos.apellido] Apellido de la persona dueña del Usuario
 * @param {String}
 *            [datos.clave] Contraseña del Usuario
 * @param {String]
 *            [datos.mail] Correo del dueño del Usuario
 */
function crearUsuario(datos) {
	return db.User.create({
		usuario: datos.usuario,
		nombre: datos.nombre,
		apellido: datos.apellido,
		clave: sha1(datos.clave + datos.usuario.toUpperCase() + SALTO_CLAVE),
		mail: datos.mail
	}).catch(db.Sequelize.ValidationError, function (e) {
		if (e.name === "SequelizeUniqueConstraintError") {
			throw new ExcepcionCDM("El usuario ya existe. ", 428);
		}
		throw e;

	});
};

/**
 * Crea un usuario
 */
exports.create = function (req, res) {
	var datos = {
		usuario: req.body.usuario,
		clave: req.body.clave,
		nombre: req.body.nombre,
		apellido: req.body.apellido,
		mail: req.body.mail
	};

	crearUsuario(datos).then(function (usuario) {
		return res.sendStatus(200);
	}).catch(ExcepcionCDM, function (e) {
		res.status(e.numero).send({ mensaje: e.mensaje });
	}).catch(function (e) {
		logger.error(e);
		res.status(500).send({ mensaje: "En estos momentos no es posible crear un usuario, por favor intente más tarde." });
	});

};

/**
 * 
 */
exports.sesionesDeTrabajo = function (req, res) {

	var consulta = "SELECT user.usuario As usuario, antigua.fechaIniciada AS fechaIniciada,"
		+ " antigua.fechaCerrada AS fechaCerrada,"
		+ " TIMESTAMPDIFF(MINUTE, antigua.fechaIniciada, antigua.fechaCerrada) AS minutos,"
		+ " antigua.keepsActivos AS minutosActivo"
		+ " FROM "
		+ tbConfig.usuarios.tabla
		+ " AS user "
		+ " INNER JOIN "
		+ tbConfig.sesiones_antiguas.tabla
		+ " AS antigua ON antigua.Userid = user.id"
		+ " WHERE user.habilitado = 'SI'";

	if (req.body.usuario && req.body.usuario.length > 0)
		consulta = consulta + ' AND user.usuario = "' + req.body.usuario + '"';

	if (req.body.fechaDesde)
		consulta = consulta + ' AND antigua.fechaIniciada >= "'
			+ req.body.fechaDesde + '"';

	if (req.body.fechaHasta)
		consulta = consulta + ' AND antigua.fechaIniciada <= "'
			+ req.body.fechaHasta + '"';

	consulta = consulta + " ORDER BY antigua.fechaIniciada";

	console.log(consulta);

	db.sequelize.query(consulta, { type: db.sequelize.QueryTypes.SELECT }).then(function (users) {

		users = users.map(function (user) {
			user.fechaIniciada = Fecha.formatear(new Date(user.fechaIniciada));
			user.fechaCerrada = Fecha.formatear(new Date(user.fechaCerrada));
			return user;
		});

		var data = {
			headers: [{
				raw: 'usuario',
				titulo: 'Usuario'
			}, {
				raw: 'fechaIniciada',
				titulo: 'Fecha Iniciada'
			}, {
				raw: 'fechaCerrada',
				titulo: 'Fecha Cerrada',
			}, {
				raw: 'minutos',
				titulo: 'Minutos'
			}, {
				raw: 'minutosActivo',
				titulo: 'Minutos Activo'
			}],
			info: users
		};

		res.status(200).send(data);
	});

};

exports.ingresos = function (req, res) {

	condicionUsuario = {};
	condicion = {};

	if (req.body.fechaDesde || req.body.fechaHasta) {

		condicion.fecha = {};

		if (req.body.fechaDesde)
			condicion.fecha.gt = req.body.fechaDesde

		if (req.body.fechaHasta)
			condicion.fecha.lt = req.body.fechaHasta
	}

	if (req.body.usuario && req.body.usuario.length > 0)
		condicionUsuario.usuario = req.body.usuario;

	db.Ingreso.findAll({
		where: condicion,
		include: [{
			model: db.User,
			as: 'User',
			where: condicionUsuario,
		}]
	}).then(function (ingresos) {

		var ingresos = ingresos.map(function (ingreso) {
			return {
				fecha: Fecha.formatear(ingreso.fecha),
				usuario: ingreso.User.usuario,
				tipo: ingreso.resultado,
				ip: ipfromLong(ingreso.ip)
			};
		});

		var data = {
			headers: [{
				raw: 'fecha',
				titulo: 'Fecha'
			}, {
				raw: 'usuario',
				titulo: 'Usuario'
			}, {
				raw: 'tipo',
				titulo: 'Exito',
			}, {
				raw: 'ip',
				titulo: 'Direccion IP',
			}],
			info: ingresos
		};

		res.status(200).send(data);
	});
};

exports.actividad = function (req, res) {

	var fechaDesde = req.body.fechaDesde;
	var fechaHasta = req.body.fechaHasta;
	var usuario = req.body.usuario;

	// Minutos en sesiones
	var consulta = "SELECT user.usuario AS Usuario,"
		+ " (SELECT "
		+ " 	SUM(TIMESTAMPDIFF(MINUTE, antigua.FechaIniciada, antigua.fechaCerrada)) "
		+ " 	FROM " + tbConfig.sesiones_antiguas.tabla
		+ " AS antigua WHERE antigua.userid = user.id";

	if (fechaDesde)
		consulta = consulta + " AND antigua.FechaIniciada >= '" + fechaDesde
			+ "'";

	if (fechaHasta)
		consulta = consulta + " AND antigua.FechaCerrada <= '" + fechaHasta
			+ "'";

	consulta = consulta + ") as Minutos, " + " (SELECT "
		+ " 	SUM(keepsActivos) " + " 	FROM "
		+ tbConfig.sesiones_antiguas.tabla
		+ " AS antigua where antigua.userid = user.id";

	if (fechaDesde)
		consulta = consulta + " AND antigua.FechaIniciada >= '" + fechaDesde
			+ "'";

	if (fechaHasta)
		consulta = consulta + " AND antigua.FechaCerrada <= '" + fechaHasta
			+ "'";

	consulta = consulta
		+ ") as MinutosActivo, "
		+ " (SELECT MAX(ingreso.fecha) "
		+ "	FROM "
		+ tbConfig.ingresos.tabla
		+ " AS ingreso WHERE ingreso.userid = user.id) as UltimoIngreso, "
		+ " 	CASE WHEN EXISTS (SELECT id FROM panel_sesiones AS sesion WHERE sesion.userid = user.id";

	if (fechaDesde)
		consulta = consulta + " AND sesion.fechaIniciada >= '" + fechaDesde
			+ "'";

	if (fechaHasta)
		consulta = consulta + " AND sesion.fechaIniciada <= '" + fechaHasta
			+ "'";

	consulta = consulta + ") " + " 	THEN 'SI' ELSE 'NO' END AS Logueado"
		+ " FROM " + tbConfig.usuarios.tabla + " as user";

	if (usuario)
		consulta = consulta + " WHERE user.usuario='" + usuario + "'";
	else
		consulta = consulta + " WHERE user.habilitado='SI'";

	consulta = consulta + " GROUP BY user.id ORDER BY user.usuario";

	db.sequelize.query(consulta, { type: db.sequelize.QueryTypes.SELECT }).then(function (users) {

		users = users.map(function (user) {
			user.UltimoIngreso = Fecha.formatear(new Date(user.UltimoIngreso));
			return user;
		});

		var data = {

			headers: [{
				raw: 'Usuario',
				titulo: 'Usuario'
			}, {
				raw: 'Minutos',
				titulo: 'Minutos'
			}, {
				raw: 'MinutosActivo',
				titulo: 'Minutos Activo'
			}, {
				raw: 'UltimoIngreso',
				titulo: 'Ultimo Ingreso'
			}, {
				raw: 'Logueado',
				titulo: 'Logueado?'
			}],
			info: users
		};

		res.status(200).send(data);
	});
}
