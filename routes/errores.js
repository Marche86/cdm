"use strict";

/**
 * 
 * @param {Object}
 *            req Objeto request de express
 * @param {Object}
 *            errores
 */
function enviarErrorParametros(res, errores) {

	var mensaje = {
		mensaje : "Error en los parametros de la consulta"
	};

	mensaje.campos = errores.map(function(error) {
		return {
			campo : error.param,
			descripcion : error.msg
		}
	});

	res.status(400).send(mensaje);
}
function enviarErrorParametros(res, req, errores) {

	var respuesta = {
		mensaje : "Parametros incorrectos.",
		parametros : []
	};
	
	for (let i = 0; i < errores.length; ++i) {
		respuesta.parametros.push({campo : errores[i].param, descripcion: errores[i].msg});
	}
	
	res.status(400).send(respuesta);

};

exports.enviarErrorParametros = enviarErrorParametros;