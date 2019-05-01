var express = require("express"),
    http = require("http"),
    https = require("https"),
    app = express(),
    fs = require("fs"),
    options = {
        key: fs.readFileSync("./ssl/private.key"),
        cert: fs.readFileSync("./ssl/certificate.crt"),
        ca: fs.readFileSync("./ssl/ca_bundle.crt"),
    },
    server = require("https").createServer(options, app),
    io = require("socket.io")(server),
    AdmZip = require('adm-zip'),
    mysql = require('mysql'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    path = require('path');

var db_config = {
	host     : 'vserver275.axc.nl',
	user     : 'mickvac275',
	password : 'Pepernoot04',
	database : 'mickvac275_nodelogin'
};

var user_data = [];

const project_name = "Gameroom"
const currentVersion = "0.0.1"

var connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();

app.use(express.static(__dirname + "/public"))
app.use(session({
	secret: 'HereComesTheSun',
	resave: true,
	saveUninitialized: true
}));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', function(request, response) {
	if (request.session.loggedin) {
		response.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
	} else {
		response.redirect('/login.html');
	}
	//response.end();
});

app.post('/auth', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
		connection.query('SELECT * FROM accounts WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
            if(error != null)
                console.error(error);
            
			if (results.length > 0) {
				request.session.loggedin = true;
				request.session.username = username;
                console.log(JSON.parse(results[0]["information"])[0]["Gamertag"]);
                
                let user_info = JSON.parse(results[0]["information"]);
                let token = makeid(24);
                user_data[token] = {
                    "user_id": results[0]["id"],
                    "user_info": {
                        "Gamertag": user_info[0]["Gamertag"],
                        "Nationality": user_info[0]["Nationality"],
                        "Birthday": user_info[0]["Birthday"],
                        "Bio": user_info[0]["Bio"],
                        "Avatar_url": user_info[0]["Avatar_url"],
                        "Games": {
                            "pc": user_info[0]["Games"]["pc"],
                            "xbox": user_info[0]["Games"]["xbox"],
                            "playstation": user_info[0]["Games"]["playstation"]
                        }
                    }
                }
				response.redirect('/dashboard?auth=' + token);
			} else {
				response.send('Incorrect Username and/or Password!');
			}			
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.post('/signup', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
    var gamertag = request.body.gamertag;
    var email = request.body.email;
    var nationality = request.body.nationality;
    var birthday = request.body.birthday;
    
    var user_info = {
        "Gamertag": gamertag,
        "Nationality": nationality,
        "Birthday": birthday,
        "Bio": "Hello, my name is " + gamertag + " !",
        "Avatar_url": "/icons/chief.png",
        "Games": {
            "pc": [],
            "playstation": [],
            "xbox": []
        }
    };
    
    var user_json = "["+JSON.stringify(user_info)+"]";
        
	if (username && password && gamertag && email && nationality && birthday) {
        connection.query('SELECT * FROM accounts WHERE username = ?', [username], function(error, results, fields) {
            if(error != null)
                console.error(error);
            
			if (results.length == 0) {
                connection.query('INSERT INTO accounts (username, password, email, information) VALUES (?, ?, ?, ?)', [username, password, email, user_json], function(error, results, fields) {
                    if(error) {
                        throw(error);
                    } else {
                        console.log("Created account: " + username);
                        response.redirect('/login.html');
                    }

                    response.end();
                });
			} else {
				response.send('Username is already taken.');
                response.end();
			}
		});
	} else {
		response.send('Please enter all info.');
		response.end();
	}
});


io.on("connection", socket => {
    
    socket.on("updateInfo", function(data) {
        if(data != null && user_data.indexOf(user_data[data["token"]] > -1)) {
            user_data[data["token"]]["user_info"] = data["user_info"];
            let json_info = '[' + JSON.stringify(user_data[data["token"]]["user_info"]) + ']';
            let user_id = user_data[data["token"]]["user_id"];
            
            console.log(user_id);
            
            connection.query('UPDATE accounts SET information = ? WHERE id = ?', [json_info, user_id], function(error, results) {
                if(error)
                    throw(error);
                else
                    console.log("updated");
            });
        }
    })
        
    socket.on("gameSearch", function(data, callback){
        
        let platform = 6;
        let query = data["query"].replace(/[^a-zA-Z ]/g, "");
        query = encodeURIComponent(query.trim());
        
        switch(data["platform"]) {
            case "pc":
                platform = 6;
                break;
            case "xbox":
                platform = 49;
                break;
            case "playstation":
                platform = 48;
                break;
            default:
                platform = 6;
                break;
        }
        
        console.log(data);
        console.log('/games/?fields=name,cover.*?search=' + query + '&filter[release_dates.platform][eq]=' + platform)
        
        https.get({
            host: 'api-v3.igdb.com',
            path: '/games/?fields=name,cover.*&search=' + query + '&filter[release_dates.platform][eq]=' + platform,
            headers: {
                'Content-Type': 'application/json',
                'user-key': 'e4e1d4601b34ba9345c3f58194003f83'
            }
        }, function(response) {
            // Continuously update stream with data
            var body = '';
            response.on('data', function(d) {
                body += d;
            });
            response.on('end', function() {
                var parsed = JSON.parse(body);
                callback(false, "success!", parsed);
                return
            });
        });
    });
    
    socket.on("getCover", function(data, callback){
        
        if (data) {
            connection.query('SELECT * FROM games WHERE game_id = ?', [data], function(error, results, fields) {
                if(error != null)
                    console.error(error);

                if (results.length < 1) {
                    
                    https.get({
                        host: 'api-v3.igdb.com',
                        path: '/games/'+data+'?fields=name,cover.*',
                        headers: {
                            'Content-Type': 'application/json',
                            'user-key': 'e4e1d4601b34ba9345c3f58194003f83'
                        }
                    }, function(response) {
                        // Continuously update stream with data
                        var body = '';
                        response.on('data', function(d) {
                            body += d;
                        });
                        response.on('end', function() {
                            var parsed = JSON.parse(body);
                            
                            if("name" in parsed[0] && "id" in parsed[0]) {
                                let cover_url = "1";
                                let game_name = parsed[0]["name"];
                                let game_id = parsed[0]["id"];
                                
                                if("cover" in parsed[0]) {
                                    cover_url = parsed[0]["cover"]["image_id"];
                                }

                                connection.query('INSERT INTO games (name, game_id, cover_id) VALUES (?, ?, ?)', [game_name, game_id, cover_url], function(error, results, fields) {
                                    if(error) {
                                        throw(error);
                                    } else {
                                        console.log("Added game: " + game_name + ' ' + game_id + ' ' + cover_url);
                                    }
                                });

                                callback(false, "success!", parsed);
                                return
                            } else {
                                callback(true, "error retrieving games.");
                                return
                            }
                        });
                    });
                } else {
                    var parsed = '[{"id": "'+results[0]["game_id"]+'", "name": "'+results[0]["name"]+'", "cover": { "image_id": "'+results[0]["cover_id"]+'"}}]';
                    parsed = JSON.parse(parsed);
                    callback(false, "success!", parsed);
                    return
                }
            });
        }
    });
    
    socket.on("retrieveInfo", function(data, callback){
        
        console.log(user_data[data]);
        if(data != null && user_data[data] != null) {
            let user_info = user_data[data]["user_info"];

            if(user_info != null) {
                callback(false, "success!", user_info);
            } else {
                callback(true, "Unauthorized.");
            }
        }
    });
});

function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

server.listen(443)
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(80);
console.log(project_name + ' is now running..')