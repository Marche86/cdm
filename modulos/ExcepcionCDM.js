"use strict";

class ExcepcionCDM extends Error {
	  constructor(mensaje, numero) {
	    super(mensaje);
	    this.mensaje = mensaje;
	    this.numero = numero;
	  }
	}

module.exports = ExcepcionCDM;