var db = require('../models');

/**
 * Almacena la información acerca del bug reportado por el usuario
 * @param {Pbject}	[datos]
 * @param {String}	[datos.metodo]			Nombre de la función donde se produjo el error
 * @param {String}	[datos.error]			Número de error
 * @param {String}	[datos.explicaciones]	explicación por parte del usuario de lo que estaba haciendo
 * @param {String}	[datos.datospc=null]	información técnica de la computadora donde se estaba ejecutando
 * @param {Object}	usuario
 * @returns {Promise}
 */
function reportarBug(datos, usuario) {
	
	// TODO: Esto no creo que este bien, pero no encontre como se hace para relacionarlo de una.
	datos.UserId = usuario.id;
	
	return db.Bug.create(datos);
}

exports.reportar = function(req, res) {
	
	var datos = {
		metodo : req.body.metodo,	
		error : req.body.error,
		explicacion : req.body.datospc,
		datospc : (req.body.datospc === undefined) ? " " : req.body.datospc
	}
	
	// TODO: Validar datos
	
	reportarBug(datos, req.usuario).then(function(){
		res.sendStatus(200);
	}).catch(function(e) {
		logger.error(e);
		res.sendStatus(500);
	});
};