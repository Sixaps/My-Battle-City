import Vue from 'vue'
import Router from 'vue-router'
import pixi from '@/components/Pixi'
import gameCore from '@/components/GameCore'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'pixi',
      component: pixi
    },
    {
      path: '/game',
      name: 'gameCore',
      component: gameCore
    }
  ]
})
