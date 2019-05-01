var socket;
var games = {
    "pc": [
        "112916",
        "55036",
        "20910",
        "102060",
        "19164",
        "22778",
        "65445"
    ],
    "playstation": [
        "6036",
        "19561",
        "113098",
        "76882"
    ],
    "xbox": [
        "987",
        "6803"
    ]
}
var user_info;
var games_info;
var auth_token;

function retrieveInfo() {
    socket.emit("retrieveInfo", auth_token,
                function(err, message, data){
                    if (!err) {
                        user_info = data;
                        console.log(data)
                        initProfile();
                        initGames();
                    } else {
                        console.log(message);
                    }
                });
}

function addGame() {
    let platform = event.target.dataset.gameplatform;
    let game_id = event.target.dataset.gameid;
    
    console.log(event.target.dataset.gameid)
    if(user_info["Games"][platform].indexOf(game_id) < 0) {
        user_info["Games"][platform].push(game_id);
        updateInfo();
        getCover(game_id, platform);
        notifyPos();
    }
}

function removeGame() {
    let platform = event.target.parentNode.dataset.gameplatform;
    let game_id = event.target.parentNode.dataset.gameid;
    let index = user_info["Games"][platform].indexOf(game_id);
    
    if(index > -1) {
        user_info["Games"][platform].splice(index, 1);
        updateInfo();
    }
    
    event.target.parentNode.remove();
}

function gameSearch() {
    if($("#search_query").val().length > 3) {
        let query = $("#search_query").val();
        let platform = $("#search_platform").val()
        
        $("#search-games").hide();
        $("#load_games").show();
        
        socket.emit("gameSearch", {
            "query": query,
            "platform": platform
        }, 
                function(err, message, data){
                    if (data != null) {
                        $('#search-games').html("");
                        data.forEach(function(game) {
                            if("cover" in game) {
                                let cover_url = game["cover"]["image_id"];
                                let game_id = game["id"];
                                loadGame(cover_url, platform, game_id);
                            }
                        });
                        $("#load_games").hide();
                        $("#search-games").show();
                    } else {
                        console.log("oiiii");
                    }
                });
    }
}

function getCover(game_id, platform) {
    socket.emit("getCover", game_id, 
                function(err, message, data){
                    if (data != null) {
                        let cover_url = data[0]["cover"]["image_id"];
                        let game_id = data[0]["id"];
                        loadCover(cover_url, platform, game_id)
                    } else {
                        console.log("oiiii");
                    }
                });
}

function updateInfo() {
    socket.emit("updateInfo", {
        "token": auth_token,
        "user_info": user_info
    })
}

function saveInfo() {
    user_info["Gamertag"] = $("#gamertag").val();
    user_info["Birthday"] = $("#birthday").val();
    user_info["Nationality"] = $("#nationality").val();
    user_info["Bio"] = $("#bio").val();
    
    checkChanges();
    updateInfo();
    initProfile();
}

function initProfile() {
    $("#gamertag").val(user_info["Gamertag"]);
    $("#username").html(user_info["Gamertag"]);
    $("#birthday").val(user_info["Birthday"]);
    $("#nationality").val(user_info["Nationality"]);
    $("#bio").val(user_info["Bio"]);
}

function initGames() {
    for(let game in user_info["Games"]["pc"]) {
        getCover(user_info["Games"]["pc"][game], "pc");
    }
    
    for(let game in user_info["Games"]["xbox"]) {
        getCover(user_info["Games"]["xbox"][game], "xbox");
    }
    
    for(let game in user_info["Games"]["playstation"]) {
        getCover(user_info["Games"]["playstation"][game], "playstation");
    }
}

function checkChanges() {
    if($("#gamertag").val() != user_info["Gamertag"] ||
    $("#birthday").val() != user_info["Birthday"] ||
    $("#nationality").val() != user_info["Nationality"] ||
    $("#bio").val() != user_info["Bio"]) {
        $("#save_changes").attr('disabled', false);
    } else {
        $("#save_changes").attr('disabled', true);
    }
}

function loadCover(cover, platform, id) {
    $('#'+platform+'-games').append("<div data-gameid="+id+" data-gameplatform='"+platform+"' class='game_item red'><span class='option' onclick='removeGame();'>x</span><img src="+"https://images.igdb.com/igdb/image/upload/t_cover_big/"+cover+".jpg"+"></div>");
}

function loadGame(cover, platform, id) {
    $('#search-games').append("<div data-gameid="+id+" data-gameplatform='"+platform+"' class='game_item green' onclick='addGame();'><img src="+"https://images.igdb.com/igdb/image/upload/t_cover_big/"+cover+".jpg"+"></div>");
}

function getQueryVariable(variable)
{
       var query = window.location.search.substring(1);
       var vars = query.split("&");
       for (var i=0;i<vars.length;i++) {
               var pair = vars[i].split("=");
               if(pair[0] == variable){return pair[1];}
       }
       return(false);
}

function searchGames(plat) {
    $("#search-games").show();
    $("#load_games").hide();
    $("#search_platform").val(plat);
    document.getElementById("showBox").classList.add("open");
    document.getElementById("overlay").classList.add("viewing");
}

function hideInfo() {
    document.getElementById("showBox").classList.remove("open");
    document.getElementById("overlay").classList.remove("viewing");
    $("#search-games").hide();
    $("#load_games").hide();
}

$(document).ready(() => {
    socket = io()
    
    auth_token = getQueryVariable("auth");
    retrieveInfo();
    
    close = document.getElementById("close_note");
    close.addEventListener('click', function() {
        note = close.parentNode;
        note.classList.remove("notifying")
    }, false);
    
    $("#showBox").on("click", function(event){
      event.stopPropagation();
    });
});