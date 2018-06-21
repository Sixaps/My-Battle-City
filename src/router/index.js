import Vue from 'vue'
import Router from 'vue-router'
import gameCore from '@/components/GameCore'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'gameCore',
      component: gameCore
    },
    {
      path: '/game',
      name: 'gameCore',
      component: gameCore
    }
  ]
})
