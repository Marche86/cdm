"use strict";

var _ = require("underscore");
var Promise = require('bluebird');
var util = require('util');

var Config = require('../../config/config.json').general;
var ExcepcionCDM = require('../../modulos/ExcepcionCDM.js');

var fs = Promise.promisifyAll(require("fs-extra"));

/**
 * Representa al repositorio.
 * 
 * @constructor
 */
function Repositorio() {
}

/**
 * Obtiene el ultimo commit para el Repositorio que aún no fue oficializado.
 * 
 * @param {db.Transaction}
 *            Transacción bajo la cual se quiere realizar la operacion.
 * @return {Promise} Retorna el Commit temporal creado que en caso de finalizar
 *         con exito, sera un nuevo commit para el repositorio
 */
Repositorio.prototype._getCommitTemporal = function (transaccion) {
	return this._getUltimoCommit(transaccion).bind(this).then(
		function (ultimoCommit) {
			return this.getCommits({
				where: {
					version: ultimoCommit.version + 1
				},
				transaction: transaccion
			});
		}).then(function (commits) {
			if (commits.length === 1) {
				return commits[0];
			} else {
				return null;
			}
		}).bind(this);
}


/**
 * Inicia un nuevo commit
 */
function iniciarCommit(t, usuario, comentario) {
	// Creo el commit
	return this._getUltimoCommit().bind(this).then(function (ultimoCommit) {
		// Creamos el commit
		return this.createCommit({
			comentario: comentario,
			version: ultimoCommit.version + 1,
			UserId: usuario.id
		}, {
				transaction: t
			});
	}).then(function (ultimoCommit) {
		// Cambiamos el estado y guardamos
		this.estado = 'CERRADO';
		return this.save({
			transaction: t
		});
	}).then(function (repositorio) {
		// Creo la carpeta donde voy a guardar los archivos
		return prepararWorkSpace.call(this);
	}).bind(); // Este bind es para quitarle el this inicial.
}


/**
 * Prepara la carpeta y los archivos necesarios para recibir contenido
 * 
 * @return {Promise.<undefined>}
 */
function prepararWorkSpace() {
	return fs.mkdirAsync(this.getPathTemp());
}

/**
 * Elimina la estructura de directorios y archivos creados para recibir
 * contenido
 * 
 * @return {Promise.<undefined>}
 */
function resetearWorkSpace() {
	return fs.statAsync(this.getPathTemp()).bind(this)
		.then(function (stats) {
			// Si existe lo borramos
			if (stats && stats.isDirectory()) return fs.removeAsync(this.getPathTemp());
		}).catch(Error, function (error) {
			if (error.code !== "ENOENT") throw error;
		}).bind();
}

/**
 * Obtiene el ultimo Commit que esta oficializado como versión del Repositorio.
 * TODO Buscar como sobreescribir correctamente getUltimoCommit
 * 
 * @param {db.Transaction}
 *            Transacción bajo la cual se quiere realizar la operacion.
 * @return {Promise.<db.Commit>} Ultimo commit para este repositorio
 */
Repositorio.prototype._getUltimoCommit = function (transaccion) {
	return this.getUltimoCommit({
		transaction: transaccion
	})
		.then(
		function (ultimoCommit) {
			if (!ultimoCommit) {
				logger
					.error(
					"El repositorio esta relacionado a un commit que no existe.",
					500);
				throw new ExcepcionCDM(
					"Se ha producido un error inesperado. El error fue registrado. Consulte al administrador.",
					500)
			}

			return ultimoCommit;
		});
}

/**
 * Desbloquea el Repositorio
 * 
 * @param {db.Transaccion}
 *            Transacción bajo la cual se quiere realizar la operacion.
 * 
 * @return {Promise.<this>}
 */
Repositorio.prototype.unlock = function (transaccion) {

	console.log("dasdad");

	if (this.estado !== 'CERRADO') {
		return Promise
			.reject(new ExcepcionCDM(
				'El repositorio no se encuentra cerrado. No se puede desbloquear.',
				201));
	}

	// Elimino el commit temporal.
	return this._getCommitTemporal(transaccion).bind(this).then(function (commitTemporal) {
		if (commitTemporal) {
			return commitTemporal.destroy({ transaction: transaccion });
		} else {
			return null;
		}
	}).then(function () {
		this.estado = 'ABIERTO';
		return this.save({ transaction: transaccion })
	}).then(function (repositorio) {
		return resetearWorkSpace.call(this);
	}).then(function () {
		return this;
	});

}

/**
 * @return {String} Retorna el Path de trabajo del repositorio donde el mismo
 *         almacena todos sus archivos
 */
Repositorio.prototype.getPath = function () {
	return (process.cwd() + Config.conestatico + '/repositorios/' + this.nombre + '/');
}

/**
 * @return {String} Retorna la carpeta donde el repositorio guarda los archivos
 *         temporales (dentro de su path de trabajo)
 */
Repositorio.prototype.getPathTemp = function () {
	return (this.getPath() + 'temp/');
}


/**
 * @param {db.Transaction}
 *            t Transaccion sobre la cual se va a realizar la operacion
 * @param {db.User}
 *            usuario Usuario que realiza la operacion
 * @param {String}
 *            comentario Comentario que describe el nuevo contenido
 * @return {Promise.<undefined>}
 */
Repositorio.prototype.iniciarNuevoCommit = function (t, usuario, comentario) {
	console.log("------------------- dasdad", this.estado);
	if (this.estado === "CERRADO") {

		return this._getCommitTemporal(t).bind(this)
			.then(function (commitTemporal) {
				// Si es el mismo usuario el que habia comenzado, lo desbloqueamos.
				if (commitTemporal.UserId === usuario.id) {

					return this.unlock(t);
				} else {
					// Sino es el, lanzamos error.
					return Promise.reject(new ExcepcionCDM('El repositorio se encuentra cerrado. Por favor, intenta en unos momentos o desbloquealo.', 423));
				}
			}).then(function () {
				return iniciarCommit.call(this, t, usuario, comentario);
			}).bind();
	} else {
		return iniciarCommit.call(this, t, usuario, comentario);
	}
}

/**
 * Agrega nuevo contenido al commit que se esta creando.
 * 
 * @param {db.Transaction}
 *            t Transaccion sobre la cual se va a realizar la operacion
 * @param {Object}
 *            [datos] Datos del contenido a agregar
 * @param {db.User}
 *            datos.usuario Usuario que agrega el contenido
 * @param {String}
 *            cambios FORMATO JSON. Cambios que contiene el archivo
 * @param {Object}
 *            archivo Archivo concreto
 * 
 * @return {Promise.<undefined>}
 */
Repositorio.prototype.agregarContenidoNuevoCommit = function (transaccion, datos) {

	/**
	 * Chequeo que este cerrado Obtengo el Commit. Chequeo que el usuario sea el
	 * mismo que creo el ultimo commit Muevo el archivo que se obtuvo, a la
	 * carpeta temporal. Creo el CommitArchivo Muevo el archivo a la carpeta
	 * temporal del repositorio
	 */

	// ¿El repo esta cerrado?
	if (this.estado !== "CERRADO")
		return Promise.reject(new ExcepcionCDM('Algo salio mal, no podés moficiar el repositorio en estos momentos.', 409));

	// Obtengo el ultimo commit que aún no es version oficial.
	return this._getCommitTemporal(transaccion).then(function (commitTemporal) {

		// Chequeos
		if (!commitTemporal) throw new ExcepcionCDM("Algo salio mal, no podés moficiar el repositorio en estos momentos.", 409);

		if (commitTemporal.UserId !== datos.usuario.id) throw new ExcepcionCDM("No sos vos el que tiene cerrado el repositorio.", 401);

		// Creamos la representacion del archivo
		return commitTemporal.createCommitArchivo({
			nombre: datos.archivo.filename,
			tamano: datos.archivo.size,
			destino: datos.origen,
			cambios: datos.cambios,
			headers: datos.headers
		}, { transaction: transaccion });
	}).then(function (commitArchivo) {
		// Movemos el archivo
		return fs.moveAsync(datos.archivo.path, this.getPathTemp() + datos.archivo.filename);
	});

};

/**
 * Cierra el proceso de creación de nuevo contenido
 * 
 * @param {db.Transaccion}
 *            transaccion Transaccion sobre la cual se realiza la operacion
 * @return {Promise.<this>}
 */
Repositorio.prototype.finalizarNuevoCommit = function (transaccion) {

	// ¿El repo esta cerrado?
	if (this.estado !== "CERRADO")
		return Promise.reject(new ExcepcionCDM('Algo salio mal, no podés moficiar el repositorio en estos momentos.', 409));

	// Obtengo el ultimo commit que aún no es version oficial.
	return this._getCommitTemporal(transaccion).bind(this).then(function (commitTemporal) {
		this.ultimoCommit = commitTemporal; // TODO. Esto va porque el sistema
		// no lo hace automatico
		return this.setUltimoCommit(commitTemporal, { save: false });
	}).then(function () {
		return this.ultimoCommit.getCommitArchivos({ transaction: transaccion });
	}).then(function (commitArchivos) {
		let confirmados = [];
		let eliminados = [];
		let promesaDisponibles = [];
		let promesaConfirmados = [];

		if (commitArchivos.length === 0) throw new ExcepcionCDM("El contenido que se quiere publicar está vacio.", 409);

		// Hacemos el recuento de todos los elementos que son parte de esta
		// actualizacion
		for (let loopCA = 0; loopCA < commitArchivos.length; ++loopCA) {

			let elemento = commitArchivos[loopCA].getElemento();
			let cambios = commitArchivos[loopCA].cambios;

			if (!elemento || typeof (elemento) === 'ElementoNoNativo') continue;

			for (let loopCambio = 0; loopCambio < cambios.length; ++loopCambio) {
				let cambio = cambios[loopCambio];
				if (cambio.accion === "ELIMINADO") {
					eliminados.push(cambio.id);
				} else if (cambio.accion === "CREADO" || cambio.accion === "MODIFICADO") {
					confirmados.push(cambio.id);
				}
			}

			// Eliminados
			if (eliminados.length > 0) {
				promesaDisponibles.push(this.sequelize.models.Recurso.update(
					{ estado: 'DISPONIBLE' },
					{
						where: {
							id: eliminados,
							tipo: elemento.nombre,
							RepositorioId: this.id
						},
						transaction: transaccion
					}));
			}

			// Confirmados
			if (confirmados.length > 0) {
				promesaConfirmados.push(this.sequelize.models.Recurso.update(
					{ estado: 'CONFIRMADO' },
					{
						where: {
							id: confirmados,
							tipo: elemento.nombre,
							RepositorioId: this.id
						},
						transaction: transaccion
					}));
			}
		}

		// Actualizamos los recursos
		return Promise.all([...promesaDisponibles, ...promesaConfirmados]);

	}).then(function (resultado) {
		return fs.moveAsync(this.getPathTemp(), this.getPath() + this.ultimoCommit.version);
	}).then(function () {
		// Guardamos
		this.estado = 'ABIERTO';
		return this.save({ transaction: transaccion });
	}).bind();

};

/**
 * Devuelve un recurso del tipo solicitando compatible con la version indicada
 * 
 * @param {db.User}
 *            usuario Usuario que solicita el recurso
 * @param {String}
 *            tipo Tpo de recurso que se quiere obtener
 * @param {Number}
 *            version Version con el cual tiene que ser compatible este recurso
 * @return {Promise.<db.Recurso>}
 */
Repositorio.prototype.getRecurso = function (usuario, tipo, version) {

	/**
	 * Generamos una transaccion. Obtenemos el recurso, lo actualizamos y lo
	 * guardamos.
	 */
	return this.sequelize.transaction(function (t) {
		// Obtenemos el recurso.
		return this.getRecursos({
			where:
			{
				tipo: tipo,
				estado: 'DISPONIBLE',
				version: { $lte: version }
			},
			limit: 1,
			order: [['id', 'ASC']],
			lock: t.LOCK.UPDATE,
			transaction: t
		})
			.then(function (recursos) {
				console.log("Recursos marcelo", util.inspect(recursos));

				if (recursos.length === 0) throw new ExcepcionCDM("No hay recurso de este tipo disponible.", 404);

				let recurso = recursos[0];

				// Cambiamos el estado
				recurso.estado = 'TOMADO';
				recurso.version = version;
				recurso.UserId = usuario.id;
				return recurso.save({ transaction: t });
			});
	}.bind(this));

}

/**
 * Exports
 */
module.exports = Repositorio;