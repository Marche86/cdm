var DeployIndicaciones = {
	'noIniciar' : {
		info : function(argumento) {
			return {
				nombre : 'No iniciar servidor',
				descripcion : 'El servidor no se iniciará automaticamente una vez implantada la actualización'
			};
		},
		activada : function(argumento) {
			return (argumento === true);
		}
	},
	'forzarApagado' : {
		info : function(argumento) {
			return {
				nombre : 'Reiniciar el servidor',
				descripcion : 'El servidor se apagará, se implantaran las actualizaciones y se iniciará'
			};
		},
		activada : function(argumento) {
			return (argumento === true);
		}
	},
	'mensajeCierre' : {
		info : function(argumento) {
			return {
				nombre : 'Mensaje al cerrar',
				descripcion : 'Cuando a los usuarios se le informe que el servidor se cerrará para implantar una actualización se adjuntará el siguiente mensaje: "'
						+ argumento + '"'
			};
		},
		activada : function(argumento) {
			if (typeof argumento === 'string' && argumento.length > 0) {
				return true;
			} else {
				return false;
			}
		}
	}
};

module.exports.obtenerIndicacion = function(nombre, argumento) {
	if (nombre in DeployIndicaciones) {
		return DeployIndicaciones[nombre];
	}
	return null;
}