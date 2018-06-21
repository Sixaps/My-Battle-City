<template>
  <div>
    <mu-dialog title="登陆" :esc-press-close="false" :overlay-close="false" :open.sync="openSimple">
      <mu-text-field v-model="id" label="请输入用户名" label-float></mu-text-field>
      <br/>
      <mu-text-field v-model="team" label="请输入队伍" label-float></mu-text-field>
      <br/>
      <mu-text-field v-model="roomid" label="请输入房间号" label-float></mu-text-field>
      <br/>
      <mu-flex class="select-control-row">
        <mu-switch v-model="isHost" label="是否房主"></mu-switch>
      </mu-flex>
      <mu-select label="请选择地图" v-model="map" full-width v-if="isHost">
        <mu-option v-for="option,index in mapOptions" :key="option" :label="option" :value="option"></mu-option>
      </mu-select>
      <mu-button slot="actions" flat color="primary" @click="closeSimpleDialog">开始游戏</mu-button>
    </mu-dialog>
    <mu-flex style="margin: 16px 0;" v-if="isLoading">
      <mu-linear-progress mode="determinate" :value="loadingValue" :size="15" color="blue"></mu-linear-progress>
    </mu-flex>
  </div>
</template>

<script>
  import * as pixi from 'pixi.js'
  import io from 'socket.io-client';

  const Pi = 3.1415926;


  export default {
    name: "gameCore",
    data() {
      return {
        mapOptions: [
          'map1', 'map2'
        ],
        map: "map1",
        loadingValue: 0,
        isLoading: false,
        isHost: false,
        openSimple: false,
        id: '',
        team: '',
        roomid: '',
        app: {},
        gameContainer: new pixi.Container(),
        Application: pixi.Application,
        loader: pixi.loader,
        resources: pixi.loader.resources,
        Sprite: pixi.Sprite,
        texture: {},
        BlockUnit: 0,
        WallSprite: new pixi.particles.ParticleContainer(),
        BulletSprite: new pixi.particles.ParticleContainer(),
        BackgroundSprite: new pixi.particles.ParticleContainer(),
        TankSprite: new pixi.Container(),
        ForestSprite: new pixi.particles.ParticleContainer(),
        WaterSprite: new pixi.particles.ParticleContainer(),
        socket: {},
        TypeDict: {"T1": "tank1.png", "T2": "tank2.png"}
      }
    },
    methods: {
      CreateTank: function (x, y, rotation, name, type, team) {
        let tank = new this.Sprite(this.texture[this.TypeDict[type]]);
        tank.live = 5;
        tank.ammunition = 4;
        tank.name = name;
        tank.team = team;
        tank.initX = x;
        tank.initY = y;
        tank.initR = rotation;
        tank.rotation = rotation;
        tank.level = 0;
        tank.bulletType = 1;
        tank.vx = 0;
        tank.vy = 0;
        tank.y = y;
        tank.x = x;
        tank.visible = true;
        tank.speed = 5;
        tank.width = tank.height = this.BlockUnit * 3 / 4;
        tank.anchor.set(0.5, 0.5);
        tank.Hit = () => {
          this.TankHit(tank)
        };
        tank.Hited = (level) => {
          this.TankHited(level, tank)
        };
        this.TankSprite.addChild(tank);
      },
      updateTank: function (tank, msg) {
        tank.live = msg.live;
        tank.ammunition = msg.ammunition;
        tank.name = msg.name;
        tank.bulletType = msg.bulletType;
        if (msg.team !== this.team) {
          console.log("reverse xy:" + msg.x + "," + msg.y);
          tank.y = this.gameContainer._height * (1 - msg.y);
          tank.x = this.gameContainer._width * (1 - msg.x);
        }
        else {
          console.log("receive xy:" + tank.x + "," + tank.y)
          tank.y = this.gameContainer._height * msg.y;
          tank.x = this.gameContainer._width * msg.x;
        }
        tank.initX = tank.x;
        tank.initY = tank.y;
      },
      fire: function (tank) {
        // console.log(tank.team);
        if (tank.bulletType <= 3) {
          let bullet = new this.Sprite(this.texture["炮弹上2.png"]);
          bullet.width = bullet.height = tank.width / 3;
          bullet.rotation = tank.rotation;
          bullet.anchor.set(0.5, 0.5);
          bullet.level = tank.bulletType;
          bullet.team = tank.team;
          tank.ammunition -= 1;
          bullet.Hit = () => {
            this.BulletHit(bullet)
          };
          // console.log(tank.rotation);
          switch (tank.rotation.toFixed(4)) {
            case (3 * Pi / 2).toFixed(4):
              bullet.vx = -tank.speed * 1.5;
              bullet.vy = 0;
              bullet.x = tank.x - this.BlockUnit / 2;
              bullet.y = tank.y;
              break;
            case (Pi / 2).toFixed(4) :
              bullet.vx = tank.speed * 1.5;
              bullet.vy = 0;
              bullet.x = tank.x + this.BlockUnit / 2;
              bullet.y = tank.y;
              break;
            case (0).toFixed(4):
              bullet.vx = 0;
              bullet.vy = -tank.speed * 1.5;
              bullet.x = tank.x;
              bullet.y = tank.y - this.BlockUnit / 2;
              break;
            case (Pi).toFixed(4)  :
              bullet.vx = 0;
              bullet.vy = tank.speed * 1.5;
              bullet.x = tank.x;
              bullet.y = tank.y + this.BlockUnit / 2;
              break;
            default   :
              bullet.vx = 0;
              bullet.vy = tank.speed * 1.5;
              bullet.x = tank.x;
              bullet.y = tank.y + this.BlockUnit * 2;
          }
          this.BulletSprite.addChild(bullet)
        }
      },
      InitMap: function (json) {
        this.texture = this.resources.Sprites.textures;
        if (this.texture === undefined)
          return;
        let map = json.map;
        let users = json.users;
        let width = json.width;
        let height = json.height;
        //对stage按照wight和height进行划分，根据map的情况新建sprite并放到指定位置，需要texture,再来一个函数才行
        this.BlockUnit = (this.app.screen.height / height > this.app.screen.width / width) ?
          this.app.screen.width / width : this.app.screen.height / height;
        let originX = (this.app.screen.width - width * this.BlockUnit) / 2;
        let originY = (this.app.screen.height - height * this.BlockUnit) / 2;

        this.gameContainer.addChild(this.BackgroundSprite, this.WallSprite, this.WaterSprite, this.TankSprite, this.BulletSprite, this.ForestSprite);
        this.gameContainer.position.set(originX, originY);
        this.gameContainer.visible = false;
        this.gameContainer._width = width * this.BlockUnit;
        this.gameContainer._height = height * this.BlockUnit;


        let type1 = this.team === 1 ? "T1" : "T2";
        let type2 = this.team === 2 ? "T1" : "T2";

        let floor_textures = [this.texture["floor1.png"], this.texture["floor2.png"], this.texture["floor4.png"], this.texture["floor3.png"]];
        for (let i = 0, x = this.BlockUnit / 2; i < width; i++, x += this.BlockUnit) {
          for (let j = 0, y = this.BlockUnit / 2; j < height; j++, y += this.BlockUnit) {
            let floor = new this.Sprite(floor_textures[(i + j) % 2 + (Math.random() < 0.2 ? 2 : 0)]);
            floor.width = floor.height = this.BlockUnit;
            floor.anchor.set(0.5, 0.5);
            floor.x = x;
            floor.y = y;
            this.BackgroundSprite.addChild(floor);

            if (map[j][i] === "I") {
              let ice = new this.Sprite(this.texture["ice2.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              ice.level = 5;
              ice.team = 3;
              ice.Hited = (level) => {
              };
              this.WallSprite.addChild(ice);
            }
            else if (map[j][i] === "W") {
              let ice = new this.Sprite(this.texture["brickwall2.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              ice.level = 1;
              ice.team = 3;
              ice.Hited = (level) => {
                this.WallHited(level, ice)
              };
              this.WallSprite.addChild(ice);
            }
            else if (map[j][i] === "S") {
              let ice = new this.Sprite(this.texture["steelwall2.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              ice.level = 2;
              ice.team = 3;
              ice.Hited = (level) => {
                this.WallHited(level, ice)
              };
              this.WallSprite.addChild(ice);
            }
            else if (map[j][i] === "R") {
              let ice = new this.Sprite(this.texture["river3-1.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              ice.level = -1;
              ice.Hited = (level) => {
              };
              this.WaterSprite.addChild(ice);
            }
            else if (map[j][i] === "F") {
              let ice = new this.Sprite(this.texture["forest2.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              this.ForestSprite.addChild(ice);
            }
            else if (map[j][i] === "B") {
              let ice = new this.Sprite(this.texture["base3.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              ice.level = 2;
              ice.live = 5;
              ice.team = this.team;
              ice.Hited = (level) => {
                this.BaseHited(level, ice);
              };
              this.WallSprite.addChild(ice);
            }
            else if (map[j][i] === "E") {
              let ice = new this.Sprite(this.texture["base4.png"]);
              ice.width = ice.height = this.BlockUnit;
              ice.anchor.set(0.5, 0.5);
              ice.x = x;
              ice.y = y;
              ice.level = 2;
              ice.live = 5;
              ice.team = this.team === 1 ? 2 : 1;
              ice.Hited = (level) => {
                this.BaseHited(level, ice);
              };
              this.WallSprite.addChild(ice);
            }
            else if (map[j][i] === "T1") {
              for (let k = 0; k < users.length; k++) {
                if (users[k].team === this.team) {
                  this.CreateTank(x, y, 0, users[k].id, type1, users[k].team);
                  users.splice(k, 1);
                  break;
                }
              }
            }
            else if (map[j][i] === "T2") {
              for (let k = 0; k < users.length; k++) {
                if (users[k].team !== this.team) {
                  this.CreateTank(x, y, Pi, users[k].id, type2, users[k].team);
                  users.splice(k, 1);
                  break;
                }
              }
            }
          }
        }
        this.app.stage.addChild(this.gameContainer);

        this.app.ticker.add(delta => this.Play(delta));

        let tanks = this.TankSprite.children;
        let tank = {};
        for (let i = 0; i < tanks.length; i++) {
          if (tanks[i].name === this.id) {
            tank = tanks[i];
          }
        }

        this.sync_cond();
        this.initkeyboardDetect();
        setInterval(() => {
          if (tank.ammunition < 4)
            tank.ammunition += 1;
        }, 1000);
        // setInterval(this.sync_cond,1000);
      },
      Play: function (delta) {
        this.HitDetectCore();
      },
      HitDetectCore: function () {
        let tanks = this.TankSprite.children;
        let walls = this.WallSprite.children;
        let bullets = this.BulletSprite.children;
        let rivers = this.WaterSprite.children;
        for (let i = 0; i < tanks.length; i++) {
          for (let j = 0; j < walls.length; j++) {
            this.HitDetect(tanks[i], walls[j]);
          }
          for (let j = 0; j < rivers.length; j++) {
            this.HitDetect(tanks[i], rivers[j]);
          }
          // if(tanks[i].name === "sixaps")
          //   console.log(tanks[i].vx,tanks[i].vy);
          tanks[i].x += tanks[i].vx * this.BlockUnit / 50;
          tanks[i].y += tanks[i].vy * this.BlockUnit / 50;
        }

        for (let i = 0; i < bullets.length; i++) {
          let flag = false;
          for (let j = 0; j < tanks.length; j++) {
            if (flag = this.HitDetect(bullets[i], tanks[j]))
              break;
          }

          if (flag)
            continue;

          for (let j = 0; j < walls.length; j++) {
            if (flag = this.HitDetect(bullets[i], walls[j]))
              break;
          }

          if (flag)
            continue;
          bullets[i].x += bullets[i].vx * this.BlockUnit / 50;
          bullets[i].y += bullets[i].vy * this.BlockUnit / 50;
        }
      },
      /**
       * @return {boolean}
       */
      HitDetect: function (Object1, Object2) {
        //Define the letiables we'll need to calculate
        let combinedHalfWidths, combinedHalfHeights, vx, vy;

        //Calculate the distance vector between the sprites
        vx = Object1.x - Object2.x;
        vy = Object1.y - Object2.y;

        //Figure out the combined half-widths and half-heights
        combinedHalfWidths = Object1.width / 2 + Object2.width / 2;
        combinedHalfHeights = Object1.height / 2 + Object2.height / 2;

        //Check for a collision on the x axis
        if (Math.abs(vx + Object1.vx * this.BlockUnit / 50) < combinedHalfWidths && Math.abs(vy + Object1.vy * this.BlockUnit / 50) < combinedHalfHeights) {
          Object1.Hit();
          // console.log(Object1.team, Object2.team);
          Object2.Hited(Object1.team !== Object2.team ? Object1.level : 0);
          return true;
        }
        return false;
      },
      //socket.io-part
      BaseHited: function (level, base) {
        base.live -= level;
        if (base.live <= 0) {
          this.GameOver(base.team);
        }
      },
      GameOver: function (team) {
        this.socket.emit('gameOver');
        if (this.team === team) {
          alert("you lose!!");
        }
        else {
          alert("you win!!");
        }
      },
      TankHited: function (level, tank) {
        tank.live -= level;
        if (tank.live <= 0) {
          this.TankDead(tank);
        }
      },
      TankDead: function (tank) {
        tank.x = -1000;
        tank.y = -1000;
        tank.visible = false;
        setTimeout(() => {
          tank.visible = true;
          tank.x = tank.initX;
          tank.y = tank.initY;
          tank.rotation = tank.initR;
          tank.live = 5;
        }, 5000);
      },
      TankHit: function (tank) {
        tank.vx = tank.vy = 0;
      },
      WallHited: function (level, wall) {
        if (wall.level <= level) {
          wall.destroy();
        }
      },
      BulletHit: function (bullet) {
        bullet.destroy();
      },
      initkeyboardDetect: function () {
        let left = this.keyboard(37),
          up = this.keyboard(38),
          right = this.keyboard(39),
          attack = this.keyboard(65),
          down = this.keyboard(40);

        let speed = 5;
        let tanks = this.TankSprite.children;
        let tank = {};
        for (let i = 0; i < tanks.length; i++) {
          if (tanks[i].name === this.id) {
            tank = tanks[i];
          }
        }

        attack.press = () => {
          if (tank.ammunition > 0) {
            this.socket.emit('tank_fire', {
              'id': this.id
            })
          }
        };
        attack.release = () => {
        };

        left.press = () => {
          this.socket.emit('tank_move', {
            'id': this.id,
            'x': tank.x / this.gameContainer._width,
            'y': tank.y / this.gameContainer._height,
            'vx': -speed,
            'vy': 0,
            'rotation': 3 * Pi / 2
          })
        };
        left.release = () => {
          if (!right.isDown && !down.isDown && !up.isDown) {
            this.socket.emit('tank_move', {
              'id': this.id,
              'x': tank.x / this.gameContainer._width,
              'y': tank.y / this.gameContainer._height,
              'vx': 0,
              'vy': 0,
              'rotation': 3 * Pi / 2
            })
          }
        };

        up.press = () => {
          this.socket.emit('tank_move', {
            'id': this.id,
            'x': tank.x / this.gameContainer._width,
            'y': tank.y / this.gameContainer._height,
            'vx': 0,
            'vy': -speed,
            'rotation': 0
          })
        };
        up.release = () => {
          if (!down.isDown && !left.isDown && !right.isDown) {
            this.socket.emit('tank_move', {
              'id': this.id,
              'x': tank.x / this.gameContainer._width,
              'y': tank.y / this.gameContainer._height,
              'vx': 0,
              'vy': 0,
              'rotation': 0
            })
          }
        };

        right.press = () => {
          this.socket.emit('tank_move', {
            'id': this.id,
            'x': tank.x / this.gameContainer._width,
            'y': tank.y / this.gameContainer._height,
            'vx': speed,
            'vy': 0,
            'rotation': Pi / 2
          })
        };
        right.release = () => {
          if (!left.isDown && !down.isDown && !up.isDown) {
            this.socket.emit('tank_move', {
              'id': this.id,
              'x': tank.x / this.gameContainer._width,
              'y': tank.y / this.gameContainer._height,
              'vx': 0,
              'vy': 0,
              'rotation': Pi / 2
            })
          }
        };

        down.press = () => {
          this.socket.emit('tank_move', {
            'id': this.id,
            'x': tank.x / this.gameContainer._width,
            'y': tank.y / this.gameContainer._height,
            'vx': 0,
            'vy': speed,
            'rotation': Pi
          })
        };
        down.release = () => {
          if (!up.isDown && !left.isDown && !right.isDown) {
            this.socket.emit('tank_move', {
              'id': this.id,
              'x': tank.x / this.gameContainer._width,
              'y': tank.y / this.gameContainer._height,
              'vx': 0,
              'vy': 0,
              'rotation': Pi
            })
          }
        };
      },
      keyboard: function (keyCode) {
        let key = {};
        key.code = keyCode;
        key.isDown = false;
        key.isUp = true;
        key.press = undefined;
        key.release = undefined;
        //The `downHandler`
        key.downHandler = event => {
          if (event.keyCode === key.code) {
            if (key.isUp && key.press) key.press();
            key.isDown = true;
            key.isUp = false;
          }
          event.preventDefault();
        };
        key.upHandler = event => {
          if (event.keyCode === key.code) {
            if (key.isDown && key.release) key.release();
            key.isDown = false;
            key.isUp = true;
          }
          event.preventDefault();
        };
        window.addEventListener(
          "keydown", key.downHandler.bind(key), false
        );
        window.addEventListener(
          "keyup", key.upHandler.bind(key), false
        );
        return key;
      },
      on_tank_move: function (msg) {
        let tanks = this.TankSprite.children;
        for (let i = 0; i < tanks.length; i++) {
          if (tanks[i].name === msg.id) {
            // if (tanks[i].team !== this.team) {
            //   console.log(msg.vx, msg.vy);
            // }
            msg = tanks[i].team === this.team ? msg : this.reverseAttr(msg);
            tanks[i].x = this.gameContainer._width * msg.x;
            tanks[i].y = this.gameContainer._height * msg.y;
            tanks[i].vx = msg.vx;
            tanks[i].vy = msg.vy;
            tanks[i].rotation = msg.rotation;
            break;
          }
        }
      },
      reverseAttr: function (msg) {
        msg.x = 1 - msg.x;
        msg.y = 1 - msg.y;
        msg.vx = -msg.vx;
        msg.vy = -msg.vy;
        msg.rotation = (Pi + msg.rotation) % (2 * Pi);
        return msg;
      },
      on_tank_fire: function (msg) {
        let tanks = this.TankSprite.children;
        for (let i = 0; i < tanks.length; i++) {
          if (tanks[i].name === msg.id) {
            this.fire(tanks[i]);
            break;
          }
        }
      },
      on_sync_cond: function (msg) {
        let tanks = this.TankSprite.children;
        for (let i = 0; i < tanks.length; i++) {
          if (tanks[i].team !== this.team)
            this.updateTank(tanks[i], msg[tanks[i].name]);
        }
        this.isLoading = false;
      },
      Init: function (json) {
        this.isLoading = true;
        this.app = new this.Application({
          width: 256,
          height: 256,
          antialias: true,
          transparent: false,
          resolution: 1
        });
        this.app.renderer.view.style.position = "absolute";
        this.app.renderer.view.style.display = "block";
        this.app.renderer.autoResize = true;
        this.app.renderer.backgroundColor = 0x2b85f4;
        this.app.renderer.resize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this.app.view);
        // this.$el.append(this.app.view);

        this.loader.crossorigin = true;
        if (this.resources.Sprites === undefined) {
          this.loader
            .add("Sprites", "/static/new_test_sprite2.json")
            .load(() => {
              this.InitMap(json)
            });
        }
        else
          this.InitMap(json);
      },
      openSimpleDialog: function () {
        this.openSimple = true;
      },
      closeSimpleDialog: function () {
        this.team = parseInt(this.team);
        this.socket.emit('join', {
          'id': this.id,
          'roomid': this.roomid,
          'team': this.team
        });
        this.openSimple = false;
        if (this.isHost) {
          this.socket.emit('gameStart', {
            'mapId': this.map
          });
        }
      },
      LoadingProgress: function (msg) {
        this.loadingValue += 100 / msg.num;
        // if(this.loadingValue >= 95){
        //   this.isLoading = false;
        // }
        this.gameContainer.visible = true;
      },
      sync_cond: function () {
        let tanks = this.TankSprite.children;
        let tank = {};
        for (let i = 0; i < tanks.length; i++) {
          if (tanks[i].name === this.id) {
            tank.live = tanks[i].live;
            tank.ammunition = tanks[i].ammunition;
            tank.name = tanks[i].name;
            tank.team = tanks[i].team;
            tank.bulletType = tanks[i].bulletType;
            tank.y = tanks[i].y / this.gameContainer._height;
            tank.x = tanks[i].x / this.gameContainer._width;
            console.log(tank.y, tank.x);
            break;
          }
        }
        if (this.isLoading)
          this.socket.emit('ready', tank);
        else
          this.socket.emit('sync_cond', tank);
      }
    },
    mounted() {
      this.socket = io.connect('localhost:3000/');
      this.socket.on('tank_move', (msg) => this.on_tank_move(msg));
      this.socket.on('tank_fire', (msg) => this.on_tank_fire(msg));
      this.socket.on('sync_cond', (msg) => this.on_sync_cond(msg));
      this.socket.on('gameStart', (msg) => this.Init(msg));
      this.socket.on('ready', (msg) => this.LoadingProgress(msg));

      this.openSimpleDialog();
    }
  }
</script>

<style scoped>

</style>
