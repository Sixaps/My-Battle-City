var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs=require('fs');

var users = {};
let tanks = {};
let status = {};
let intervals = {}
app.use(express.static(__dirname + '/dist'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {

  socket.on('gameStart', function (msg) {
    loadMap(msg.mapId, socket.room);
  });

  socket.on('ready',function(msg){
    tanks[socket.room][msg.name] = msg;
    status[socket.room][msg.name] = true;
    io.to(socket.room).emit('ready',{
      'num' : Object.keys(users[socket.room]).length
    });
    for(let key in status[socket.room]){
      if(status[socket.room][key] === false)
        return;
    }
    sync_cond(socket.room)
    // intervals[socket.room] = setInterval(()=>{sync_cond(socket.room)},1000);
  });

  socket.on('join', function (msg) {
    socket.name = msg.id;
    socket.room = msg.roomid;
    if (!users[msg.roomid]) {
      users[msg.roomid] = {};
      tanks[socket.room] = {};
      status[socket.room] = {};
    }
    console.log(status[socket.room]);
    users[msg.roomid][msg.id] = msg;
    status[socket.room][msg.id] = false;
    tanks[socket.room][msg.id] = {};
    socket.join(msg.roomid);
    console.log(socket.name + '加入了' + msg.roomid + "房间");
    console.log("房间当前成员:" + Object.keys(users[socket.room]));
    console.log("共"+ Object.keys(users[socket.room]).length + "人");
  });

  socket.on('sync_cond',function(msg){
    // console.log(msg);
    if (users[socket.room] && users[socket.room].hasOwnProperty(socket.name)) {
      tanks[socket.room][msg.name].x = msg.x;
      tanks[socket.room][msg.name].y = msg.y;
      tanks[socket.room][msg.name].team = msg.team;
      tanks[socket.room][msg.name].rotation = msg.rotation;
      tanks[socket.room][msg.name].bulletType = msg.bulletType;
      tanks[socket.room][msg.name].live = msg.live;
      tanks[socket.room][msg.name].ammunition = msg.ammunition;
    }
  });

  socket.on('tank_move', function (msg) {
    io.to(socket.room).emit('tank_move', msg);
  });
  socket.on('tank_fire', function (msg) {
    io.to(socket.room).emit('tank_fire', msg);
  });
  socket.on('disconnect', function () {
    if (users[socket.room] && users[socket.room].hasOwnProperty(socket.name)) {
      delete users[socket.room][socket.name];
      console.log(socket.name + '退出了' + socket.room + "房间");
      console.log("房间当前成员:" + Object.keys(users[socket.room]));
      console.log("共"+ Object.keys(users[socket.room]).length + "人");
      socket.leave(socket.room)
    }
    if (tanks[socket.room] && tanks[socket.room].hasOwnProperty(socket.name)) {
      delete tanks[socket.room][socket.name];
      delete status[socket.room][socket.name];
    }
  });

  socket.on('gameOver',function(msg){
    clearInterval(intervals[socket.room]);
    delete tanks[socket.room];
    delete status[socket.room];
    delete users[socket.room];
  })
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});

function sync_cond(room){
  console.log(tanks[room]);
  io.to(room).emit('sync_cond', tanks[room]);
}

function loadMap(map, roomid) {
  let file = "./static/" + map + ".json"
  fs.readFile(file, function (err, buffer) {
    gameStart(roomid)(buffer);
  });
}

function gameStart(roomid) {
  return (json) => {
    json = JSON.parse(json);
    let gameUsers = [];
    for (let key in users[roomid]) {
      gameUsers.push(users[roomid][key]);
    }
    json.users = gameUsers;
    io.to(roomid).emit('gameStart', json);
    console.log(roomid + '房间开始游戏');
  }
}
