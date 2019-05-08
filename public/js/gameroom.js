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
var room;

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

function start_search() {
    if($("#se_minage").val() > 0 && $("#se_maxage").val() > 0) {
        console.log("starting search")
        let minage = $("#se_minage").val();
        let maxage = $("#se_maxage").val();
        let nationality = $("#se_nationality").val();
        let platform = $("#se_platform").val();
        let common = $("#se_games").val();
        
        $("#div_players").hide();
        $("#div_cancel").show();
        $("#search_players").show();
        
        socket.emit("ready", {
            "Nationality": nationality,
            "Platform": platform,
            "minAge": minage,
            "maxAge": maxage,
            "Common": common,
            "Birthday": user_info["Birthday"],
            "Games": user_info["Games"]
        }, auth_token)
    }
}

function stop_search() {
    socket.emit("unready");
    
    $("#div_players").show();
    $("#div_cancel").hide();
    $("#search_players").hide();
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

function openChat() {
    clearActivePage();
    document.getElementById("profile").classList.add("farleft");
    document.getElementById("hub").classList.add("left");
    document.getElementById("search").classList.add("left");
    document.getElementById("profile_page").classList.remove("active");
    document.getElementById("hub_page").classList.remove("active");
    document.getElementById("search_page").classList.remove("active");
    document.getElementById("messages_page").classList.add("active");
    $("#messages").css('visibility', 'visible');
}

function hideChat() {
    $("#messages").css('visibility', 'hidden');
}

function clearActivePage() {
    hideChat();
    document.getElementById("profile_page").classList.remove("active");
    document.getElementById("hub_page").classList.remove("active");
    document.getElementById("search_page").classList.remove("active");
    document.getElementById("messages_page").classList.remove("active");
    document.getElementById("hub").classList = "content";
    document.getElementById("profile").classList = "content";
    document.getElementById("search").classList = "content";
};

function profile_open() {
    clearActivePage();
    document.getElementById("hub").classList.add("right");
    document.getElementById("search").classList.add("farright");
    document.getElementById("profile_page").classList.add("active");
};

function hub_open() {
    clearActivePage();
    document.getElementById("profile").classList.add("left");
    document.getElementById("search").classList.add("right");
    document.getElementById("hub_page").classList.add("active");
};

function search_open() {
    clearActivePage();
    document.getElementById("profile").classList.add("farleft");
    document.getElementById("hub").classList.add("left");
    document.getElementById("search_page").classList.add("active");
};

function notifyPos() {
    document.getElementById("pos").classList.add("notifying");
    setTimeout(function(){document.getElementById("pos").classList.remove("notifying");}, 2000);
};

$(document).ready(() => {
    socket = io()
    
    auth_token = getQueryVariable("auth");
    retrieveInfo();
    
    socket.on('match', function(data) {
        console.log(data);
        $("#div_players").show();
        $("#div_cancel").hide();
        $("#search_players").hide();
        room = data.room;
        $("#message_box").html("");
        $("#message_box").append("<li class='announce'><div class='match_info'><img src='"+data.Avatar+"'><span id='match_gamertag'>"+data.Gamertag+"</span><span id='match_bio'>"+data.Age+", "+data.Nationality+"</span></div></li><li class='announce'><div class='match_info' style='height: auto;'><span id='match_desc'>"+data.Bio+"</span></div></li>")
        openChat();
    });
    
    close = document.getElementById("close_note");
    close.addEventListener('click', function() {
        note = close.parentNode;
        note.classList.remove("notifying")
    }, false);
    
    $("#showBox").on("click", function(event){
      event.stopPropagation();
    });
    
    $('form').submit(function(e){
      e.preventDefault(); // prevents page reloading
        console.log(room)
        if($('#m').val() != "" && room != null) {
            socket.emit('chat message', $('#m').val(), room);
            $('#message_box').scrollTop($('#message_box').prop('scrollHeight'));
            $('#message_box').append('<li><div class="incoming">'+$("#m").val()+'</div></li>');
            $('#m').val('');
            return false;
        } else {
            console.log('om')
        }
    });
    
    socket.on('chat message', function(msg){
        $('#message_box').append('<li><div>'+msg+'</div></li>');
        $('#message_box').scrollTop($('#message_box').prop('scrollHeight'));
    });
    
});