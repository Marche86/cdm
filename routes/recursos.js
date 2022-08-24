var db = require('../models');
var Errores = require('./errores.js');
var ExcepcionCDM = require('../modulos/ExcepcionCDM.js');

/**
 * 
 */
exports.solicitar = function(req, res) {

	// Chequeos
    req.checkParams('tipo', 'Tenes que ingresar el tipo de recurso que queres solicitar.').isIn(Elementos.getNombresVersionados());
    req.checkParams('version', 'Tenes que ingresar la version de tu editor.').isInt({min : 1});
    
    var errores = req.validationErrors();
    if (errores) {
    	Errores.enviarErrorParametros(res, req, errores);
        return;
    }

    //
    var tipo = req.params.tipo;
    var version = req.params.version;
	var usuario = req.usuario;
  
    req.repositorio.getRecurso(usuario, tipo, version)
    		.then(function(recurso) {	    				
					res.status(200).send({id : recurso.id});
    		}).catch(ExcepcionCDM, function(e) {
	    		    res.status(e.numero).send({mensaje : e.mensaje});
    		}).catch(function(e) {
	    		    logger.error("Error al iniciar nuevo contenido en el repositorio", e);
	    		    res.status(500).send({mensaje : "En estos momentos no es posible realizar la accion"});
	    	});
}