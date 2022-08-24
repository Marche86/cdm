var nodemailer = require("nodemailer");
var smtpTransport = require('nodemailer-smtp-transport');
var config = require('../config/config.json').mailing;

function Mail() {
	this.smtpTransport = nodemailer.createTransport(smtpTransport({
		auth : {
			user : config.usuario,
			pass : config.clave,
		},
		host : config.host,
		port : config.puerto,
		secure : config.ssl,
		tls : {
			rejectUnauthorized : config.ignorarCertificadoCliente
		}
	}));

	this.sender = config.casilla;
}

Mail.prototype.enviar = function(destinatario, titulo, texto) {

	var mailOptions = {
		from : this.sender,
		to : destinatario,
		subject : titulo,
		html : texto
	};

	this.smtpTransport.sendMail(mailOptions, function(error, info) {
		if (error) {
			logger.error("Enviar correo electronico");
			logger.error(error);
		}
	});
};

/* EXPORTACIONES */
module.exports = Mail;