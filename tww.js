var Twit = require('twit')
var express = require('express');
var app = express();

var COOKIE_SECRET = 'secretsecret'
var COOKIE_KEY    = 'connect.sid'

var MemoryStore = require('express-session').MemoryStore;
var sessionStore = new MemoryStore();

var Session = require('express-session').Session;
var server = require('http').Server(app);

app.set('views', __dirname + '/views');
app.set('view engine', 'twig');

app.set('twig options', { 
    strict_variables: false
});

app.use(require('express-session')({
    secret: 'secretsecret',
    store: sessionStore,
    cookie: {
        httpOnly: false,
        maxAge: new Date(Date.now() + 60 * 60 * 1000)
    }
}));

app.use(express.static(__dirname + '/public'));

server.listen(3000);

var io = require('socket.io').listen(server);

io.use(function(socket, next) {
	var cookie = require('cookie').parse(socket.request.headers.cookie)
	cookie = require('cookie-parser/lib/parse').signedCookies(cookie, COOKIE_SECRET)
	var sessionID = cookie[COOKIE_KEY];
	sessionStore.get(sessionID, function(err, session) {
		if(!err && session){
			socket.session = new Session({sessionID: sessionID, sessionStore: sessionStore}, session);
			next(null, true);
		}else{
			next(err ? err.message : 'handshake failed');
		}
	})
})

io.on('connection', function(socket) {
	session = socket.handshake.session;
	var conf = require("./twitter-token");
	conf.access_token = socket.session.twitter_access_token_key;
	conf.access_token_secret = socket.session.twitter_access_token_secret;
	console.log(conf);

	var tww = new Twit(conf);
	var stream = tww.stream('user');
	var screen_name = null;

	tww.get('account/verify_credentials', {}, function(err, data, response) {
		screen_name = data.screen_name;
	})

	stream.on('tweet', function(tweet) {
    	console.log('tweet', tweet);
    	socket.emit('tweet', tweet);
    	if(screen_name && tweet.text.indexOf("@" + screen_name) > -1){
    		socket.emit('reply', tweet);
    	}
	});

	stream.on('favorite', function(eventMsg) {
    	console.log('event', eventMsg);
    	socket.emit('favorite', eventMsg);
	});

	socket.on("post", function(tweet, fn) {
		tww.post('statuses/update', { status: tweet }, function(err, data, response) {
			fn(err);
		});
	})

})

var twitter = require("twitter");

var twit = new twitter(require("./twitter-token"));

app.get('/', twit.gatekeeper('/login'), function(req, res) {
    req.session.twitter_access_token_key = twit.options.access_token_key;
    req.session.twitter_access_token_secret = twit.options.access_token_secret;
    req.session.hoge = "fuga";
    res.render('top', {
        message : "Hello World"
    });
});

app.get('/twauth', twit.login());

app.get('/login', function(req, res) {
    res.render('login', {
        message : "Hello World"
    });
});


app.get('/logout', function(req, res) {
	res.clearCookie('twauth');
	res.redirect('/');
})

