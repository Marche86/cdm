/**
 * 
 * @param texto {String}
 * @returns {String} La primera letra en mayuscula 
 */
function capitalize(texto) {
    return (texto ? texto[0].toUpperCase() + texto.slice(1).toLowerCase() :"");
}

module.exports.capitalize = capitalize;
