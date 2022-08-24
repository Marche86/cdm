// Librerias necesarias
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var multer  = require('multer');
var expressValidator = require('express-validator');
var uploader = multer({ dest: './uploads/'});

var log4js = require('log4js');

log4js.configure({
 appenders: [
   { type: 'console' },
   { type: 'file', filename: './logs/requests.log', category: 'request' }
  ]
});

var logger = log4js.getLogger('request');
logger.setLevel('INFO');

	
var tokenParser = require('./middlewares/token-Parser.js');
var log = require('./modulos/Logger.js');
var db = require('./models');
var geConfig = require('./config/config.json').general;
var sesiones = require('./routes/session.js');

// Rutas
var routeSession = require('./routes/session.js');
var routeBugs = require('./routes/bugs.js');
var routeRecursos = require('./routes/recursos.js');
var routeUsuarios = require('./routes/user.js');
var routeRepositorios = require('./routes/repositorios.js');
var routeAmbientes = require('./routes/ambientes.js');

log.iniciar('eventos', 'INFO', true);

// Creamos la APP
var app = express();

global.moment = require('moment');
global.moment.locale('es-AR');

// Configuracion de la APP
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(expressValidator());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(tokenParser());
app.enable('trust proxy');

app.use(log4js.connectLogger(logger, { level: log4js.levels.INFO, format: ":method :url :status - :response-time ms" }));

// Rutas
app.get('/repositorios/:repo/:version/:archivo', routeRepositorios.descargarArchivo);

app.post('/ingresar', routeSession.iniciarSesion);

// - A partir de aca para todas las secciones se debe estar validado
app.all('*', routeSession.validarSesion);

app.post('/salir', routeSession.cerrarSesion);
app.post('/keepalive', routeSession.keepAlive);

app.unlock('/r/:repo/', routeRepositorios.unlock);

app.get('/r/:repo/info', routeRepositorios.cargarRepositorio, routeRepositorios.info);
app.get('/r/:repo/log/:version', routeRepositorios.cargarRepositorio, routeRepositorios.log);
app.get('/r/:repo/update/:version', routeRepositorios.cargarRepositorio, routeRepositorios.update);

app.post('/r/:repo/commit/begin', routeRepositorios.commit_begin);
app.post('/r/:repo/commit/end', routeRepositorios.commit_end);

var upload =  uploader.single('archivo');
app.post('/r/:repo/commit/upload',	function(req, res, next) {
										upload(req, res, function(error) {
											if (error) {
												res.status(400).json({mensaje : "Error al subir el archivo"});
											} else {
												next();
											}
										})
									}, routeRepositorios.commit_upload);

// Recursos
app.get('/r/:repo/recursos/:tipo/:version', routeRepositorios.cargarRepositorio, routeRecursos.solicitar);

// Obtener ambientes disponibles
app.get('/a/', routeAmbientes.infoAmbientes);

// Obtener informacion general del ambiente
app.get('/a/:ambiente/info', routeAmbientes.infoAmbiente);

// GET: Obtiene los elementos disponibles para deployar
// POST: Crea un Deploy
// DELETE: Rollback o cancela un deploy
app.route('/a/:ambiente/deploy')
.get(routeAmbientes.obtenerElementosDisponibles)
.post(routeAmbientes.crearDeploy)
.delete(routeAmbientes.cancelarDeploy);

// GET obtiene los elementos para esta version
app.get('a/:ambiente/deploy/:version', routeAmbientes.obtenerDeploy);

// Administativo
app.post('/users/create', routeUsuarios.create);

app.get('/users/actividad', routeUsuarios.actividad);
app.get('/users/ingresos', routeUsuarios.ingresos);
app.get('/users/sesiones', routeUsuarios.sesionesDeTrabajo);

// Bugs
app.post('/bugs', routeBugs.reportar);

app.set('config', geConfig);
app.set('db', db);

// Feo que esto este Acá.
setInterval(sesiones.cerrarSesiones, 60000);

app.use(function paginaNoEncontrada(req, res, next) {
	  res.status(404).send('Funcionalidad no disponible.');
});
app.use(function error(err, req, res, next) {
	console.log(err);
	res.status(500).json({
		mensaje : "Error",
	});
});

module.exports = app;