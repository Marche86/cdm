var tbConfig = require('../config/config.json').tbConfig.elemento;

const
EDITOR = 1;
const
SERVER = 2;
const
CLIENTE = 4;

module.exports = function(sequelize, DataTypes) {
	var Elemento = sequelize.define('Elemento', {
		nombre : {
			type : DataTypes.STRING(40),
			allowNull : false,
			unique : true,
		},
		humano : {
			type : DataTypes.STRING(200),
			allowNull : false,
		},
		subelementos : {
			type : DataTypes.BOOLEAN,
			allowNull : false,
		},
		tipo : {
			type : DataTypes.ENUM('INI', 'PACK', 'CRUDO'),
			allowNull : false,
		},
		fuente : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false
		}
	}, {
		instanceMethods : {
			utilizadoCliente : function() {
				return (this.fuente & CLIENTE);
			},
			utilizadoServidor : function() {
				return (this.fuente & SERVER);
			},
			utilizadoEditor : function() {
				return (this.fuente & EDITOR)
			},
			admiteSubElementos : function() {
				return this.subelementos;
			},
			getTipo : function() {
				return "NATIVO";
			}
		},
		timestamps : false,
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
	});

	return Elemento;
};