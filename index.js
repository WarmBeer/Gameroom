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
var clients = [];
var rooms = new Array();

const project_name = "Gameroom"
const currentVersion = "0.0.1"

var connection;

function _calculateAge(birthday) { // birthday is a date
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

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

function checkMatch(client1, client2) {
    
    let common_games = 0;
    let common_games_pc = [];
    let common_games_xbox = [];
    let common_games_playstation = [];

    if(client1.data["Nationality"] != client2.data["Nationality"] && (client1.data["Nationality"] != "all" || client2.data["Nationality"] != "all")) {
        console.log("no national");
        return false;
    }

    if(client1.data["minAge"] > _calculateAge(new Date(client2.data["Birthday"])) || _calculateAge(new Date(client2.data["Birthday"])) > client1.data["maxAge"]) {
        console.log("no age");
        return false;
    }

    //Games in common
    if(client1.data["Platform"] == "pc" || client1.data["Platform"] == "all") {
        for(let g = 0;g < client1.data["Games"]["pc"].length;g++) {
            if(client2.data["Games"]["pc"].indexOf(client1.data["Games"]["pc"][g]) > -1) {
                common_games_pc.push(client1.data["Games"]["pc"][g]);
            }
        }
    }

    if(client1.data["Platform"] == "xbox" || client1.data["Platform"] == "all") {
        for(let g = 0;g < client1.data["Games"]["xbox"].length;g++) {
            if(client2.data["Games"]["xbox"].indexOf(client1.data["Games"]["xbox"][g]) > -1) {
                common_games_xbox.push(client1.data["Games"]["xbox"][g]);
            }
        }
    }

    if(client1.data["Platform"] == "playstation" || client1.data["Platform"] == "all") {
        for(let g = 0;g < client1.data["Games"]["playstation"].length;g++) {
            if(client2.data["Games"]["playstation"].indexOf(client1.data["Games"]["playstation"][g]) > -1) {
                common_games_playstation.push(client1.data["Games"]["playstation"][g]);
            }
        }
    }
    
    common_games = common_games_pc.length + common_games_xbox.length + common_games_playstation.length;
    
    if(common_games < client1.data["Common"] || common_games < client2.data["Common"]) {
        console.log("no common");
        return false;
    }
    
    return {
        "pc": common_games_pc,
        "xbox": common_games_xbox,
        "playstation": common_games_playstation
    }
};

//poll to match users
function pollFunc(fn, interval) {
    interval = interval || 1000;
    (function p() {
        fn();
        setTimeout(p, interval);

    })();
};

pollFunc(function() {
    var pairs = [];
    for (var i = clients.length - 1; i >= 0; i--) {

        var currUser;
        if (clients[i].ready && !clients[i].hasPair) {
            currUser = clients[i];
            for (var c = clients.length - 1; c >= 0; c--) {
                if (clients[c].ready && !clients[c].hasPair && currUser !== clients[c]) {
                    let common_games = checkMatch(currUser, clients[c]);
                    if(common_games) {
                        pairs.push({
                            a: currUser,
                            b: clients[c],
                            info: common_games
                        });
                        currUser.ready = false;
                        clients[c].ready = false;
                        currUser.hasPair = true;
                        clients[c].hasPair = true;   
                    }
                }
            }
        }
    }
    
    for (var b = pairs.length - 1; b >= 0; b--) {
        console.log('Pair Made Between: "' + pairs[b].a.userid + '"" and "' + pairs[b].b.userid + '"" with common games: ' + pairs[b].info);
        var secret = makeid(24);
        rooms[secret] = {
            a: pairs[b].a,
            b: pairs[b].b
        }
        console.log(pairs[b].b.information);
        pairs[b].a.emit('match', { 
            Gamertag: pairs[b].b.information['Gamertag'],
            Nationality: pairs[b].b.information['Nationality'],
            Bio: pairs[b].b.information['Bio'],
            Avatar: pairs[b].b.information['Avatar_url'],
            Age: _calculateAge(new Date(pairs[b].b.information['Birthday'])),
            info: pairs[b].info,
            room: secret
        });
        pairs[b].b.emit('match', { 
            Gamertag: pairs[b].a.information['Gamertag'],
            Nationality: pairs[b].a.information['Nationality'],
            Bio: pairs[b].a.information['Bio'],
            Avatar: pairs[b].a.information['Avatar_url'],
            Age: _calculateAge(new Date(pairs[b].a.information['Birthday'])),
            info: pairs[b].info,
            room: secret
        });
    }
}, 1000);

io.on("connection", socket => {    
    clients.push(socket);
    
    socket.on("chat message", function(msg, roomkey){
        if(rooms[roomkey].a != socket) {
            rooms[roomkey].a.emit('chat message', msg);
        } else {
            rooms[roomkey].b.emit('chat message', msg);
        }
    });
    
    socket.on("ready", function(data, token) {
        clients[clients.indexOf(socket)].userid = user_data[token]["user_id"];
        clients[clients.indexOf(socket)].information = user_data[token]['user_info'];
        clients[clients.indexOf(socket)].data = data;
        clients[clients.indexOf(socket)].ready = true;
        clients[clients.indexOf(socket)].hasPair = false;
    });
    
    socket.on("unready", function() {
        clients[clients.indexOf(socket)].ready = false;
        clients[clients.indexOf(socket)].hasPair = true
    });
    
    socket.on("disconnect", function() {
        clients.splice(clients.indexOf(socket), 1);
    })
    
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
    
    socket.on("start_search", function(data, token, callback) {
        
        if(data != null && user_data.indexOf(user_data[token] > -1)) {
            console.log("searching...");
            let user_id = user_data[token]["user_id"];
            let own_posts = 0;
            
            connection.query('SELECT * FROM posts WHERE matched = 0', [], function(error, results, fields) {
                if(error != null)
                    console.error(error);
                
                var current_match;

                if (results.length > 0) {
                    for(var i = 0;i < results.length;i++) {
                        let common_games_pc = [];
                        let common_games_xbox = [];
                        let common_games_playstation = [];
                        let common_games = 0;
                        let post_info = JSON.parse(results[i]["information"]);
                        
                        if(results[i]["user_id"] == user_id) {
                            own_posts++;
                            continue;
                        }
                        
                        if(data["Nationality"] != post_info["Nationality"] && data["Nationality"] != "all") {
                            console.log("no national");
                            continue;
                        }
                        
                        if(data["minAge"] > _calculateAge(new Date(post_info["Birthday"])) || _calculateAge(new Date(post_info["Birthday"])) > data["maxAge"]) {
                            console.log("no age");
                            continue;
                        }
                                                
                        //Games in common
                        if(data["Platform"] == "pc" || data["Platform"] == "all") {
                            for(let g = 0;g < data["Games"]["pc"].length;g++) {
                                if(post_info["Games"]["pc"].indexOf(data["Games"]["pc"][g]) > -1) {
                                    common_games_pc.push(data["Games"]["pc"][g]);
                                }
                            }
                        }
                        
                        if(data["Platform"] == "xbox" || data["Platform"] == "all") {
                            for(let g = 0;g < data["Games"]["xbox"].length;g++) {
                                if(post_info["Games"]["xbox"].indexOf(data["Games"]["xbox"][g]) > -1) {
                                    common_games_xbox.push(data["Games"]["xbox"][g]);
                                }
                            }
                        }
                        
                        if(data["Platform"] == "playstation" || data["Platform"] == "all") {
                            for(let g = 0;g < data["Games"]["playstation"].length;g++) {
                                if(post_info["Games"]["playstation"].indexOf(data["Games"]["playstation"][g]) > -1) {
                                    common_games_playstation.push(data["Games"]["playstation"][g]);
                                }
                            }
                        }
                        
                        common_games = common_games_pc.length + common_games_playstation.length + common_games_xbox.length;
                        
                        if(common_games < data["Common"] || common_games < post_info["Common"]) {
                            console.log("no common: " + common_games);
                            continue;
                        }
                        
                        if(current_match == null || current_match != null && common_games > current_match["Common"]) {
                            current_match = {
                                "id": results[i]["id"],
                                "Common": common_games,
                                "Games": {
                                    "pc": common_games_pc,
                                    "xbox": common_games_xbox,
                                    "playstation": common_games_playstation
                                },
                                "post": post_info
                            }
                            console.log(current_match)
                        }
                    }
                    if(current_match != null) {
                        connection.query('UPDATE posts SET matched = ? WHERE id = ?', [user_id, current_match["id"]], function(error, results) {
                            if(error)
                                throw(error);
                            else
                                console.log("updated");
                        });
                        
                        callback(false, current_match);
                        return;
                    } else {
                        let post_json = data;
                            post_json = JSON.stringify(post_json);
                            connection.query('INSERT INTO posts (user_id, matched, information) VALUES (?, ?, ?)', [user_id, 0, post_json], function(error, results, fields) {
                                if(error) {
                                    throw(error);
                                } else {
                                    console.log("Created post");
                                }
                            });
                        
                        while(current_match == null) {
                            connection.query('SELECT * FROM posts WHERE matched != 0 AND confirmed == 0 AND user_id = ?', [user_id], function(error, results, fields) {
                                if(error != null)
                                    console.error(error);
                                
                                if(results > 0) {
                                    
                                }
                            });
                        }
                        
                        callback(true, "No match.");
                        return;
                    }
                } else {
                    let post_json = data;
                    post_json = JSON.stringify(post_json);
                    connection.query('INSERT INTO posts (user_id, matched, information) VALUES (?, ?, ?)', [user_id, 0, post_json], function(error, results, fields) {
                        if(error) {
                            throw(error);
                        } else {
                            console.log("Created post");
                        }
                    });
                    
                    callback(true, "No match.");
                    return;
                }
            });
        } else {
            console.log("not searching...");
        }
    });
        
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