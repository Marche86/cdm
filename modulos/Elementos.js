"use strict";

var db = require('../models');
var ElementoNoNativo = require('./ElementoNoNativo.js');
var Promise = require('bluebird');
var util = require('util');
var _ = require("underscore");

var db = require('../models');

/**
 * @constructor
 * @returns
 */
class Elementos {
	
	/**
	 * @constructor
	 */
	constructor () {
		this.cache = {};
	}
	
	/**
	 * 
	 */
	iniciar() {
		return db.Elemento.findAll().then(function(elementos) {
			this.cache = {};
			elementos.map(function(elemento) {
				this.cache[elemento.nombre] = elemento;
			}.bind(this) );
		}.bind(this));
	}
	
	getNombresVersionados() {
		return _.map(this.cache, function(elementoVersionado) {
			return elementoVersionado.nombre;
		});
	}
	/***
	 * @param nombreElemento {String} Nombre del elemento que se quiere obtener
	 */
	obtenerElemento(nombreElemento) {
		// Si es un elemento nativo lo tengo en el cache
		if (nombreElemento in this.cache) return this.cache[nombreElemento];
	
		if (ElementoNoNativo.esValido(nombreElemento)) {
			// Si no creo el elemento espacial
			return new ElementoNoNativo(nombreElemento);
		} else {
			return null
		}
	}
}

/**
 * 
 * @param nombre
 * @returns
 */


module.exports = Elementos;