var log4js = require('log4js');

function iniciar(nombre, nivel, consola) {
    consola || (consola = false);

    if (!consola)
        log4js.clearAppenders();

    log4js.loadAppender('file');

    log4js.addAppender(log4js.appenders.file('logs/' + nombre + '.log'),
            '>');

    var logger = log4js.getLogger('>');
    logger.setLevel(nivel);
    global.logger = logger;
};

exports.iniciar = iniciar;