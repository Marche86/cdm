"use strict";

class ElementoNoNativo {
	constructor(nombre) {
		this.tipo = "";
		this.nombre = nombre.substr(nombre.indexOf("\\") + 1);		
		this.destino = nombre.substr(0, nombre.indexOf("\\"))
		this.humano = nombre;
		this.tipo = "CRUDO";
	}
	
	utilizadoCliente() {
		return (this.destino === 'CLIENTE');
	}
	
	utilizadoServidor() {
		return (this.destino === 'SERVER');
	}
	
	utilizadoEditor() {
		return (this.destino === 'EDITOR');
	}
	
	getTipo() {
		return "NONATIVO";
	}
	
	admiteSubElementos() {
		return false;
	}
	
	/**
	 * Indica si el elemento es un elemento no nativo
	 * @return {Boolean}
	 */
	static esValido(nombre) {
		let posBarra = nombre.indexOf("\\");
		let destino;
		
		if (posBarra === -1) return false;
		
		destino = nombre.substr(0, nombre.indexOf("\\"));
		
		return (['CLIENTE', 'SERVER', 'EDITOR'].indexOf(destino) >= 0);
	}
}

module.exports = ElementoNoNativo;