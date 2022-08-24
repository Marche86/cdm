/**
 * 
 * @param ts_hms
 *            Date
 * @returns {String}
 */
function formatear(ts_hms) {
	return ts_hms.getFullYear() + '-'
			+ ("0" + (ts_hms.getMonth() + 1)).slice(-2) + '-'
			+ ("0" + (ts_hms.getDate() + 1)).slice(-2) + ' '
			+ ("0" + ts_hms.getHours()).slice(-2) + ':'
			+ ("0" + ts_hms.getMinutes()).slice(-2) + ':'
			+ ("0" + ts_hms.getSeconds()).slice(-2);
}

/**
 * Retorna una fecha considerando que la fecha pasada por parametros esta en UTC
 * 
 * @param {String}
 *            fecha Fecha que se quiere considerar expresada en UTC
 */
function UTCStringToDate(fecha) {
	var fechaDate = new Date(fecha);
	return new Date(fechaDate.getUTCFullYear(), fechaDate.getUTCMonth(),
			fechaDate.getUTCDate(), fechaDate.getUTCHours(), fechaDate
					.getUTCMinutes(), fechaDate.getUTCSeconds());
}

module.exports.formatear = formatear;
module.exports.UTCStringToDate = UTCStringToDate;