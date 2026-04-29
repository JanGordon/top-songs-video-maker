import {createApp} from "vue"
import App from "./ui/app.vue"

const app = createApp(App)



app.directive('context', {
  mounted(el, binding) {
    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Use a custom event to notify your single global menu
      const event = new CustomEvent('show-context-menu', {
        detail: { 
          x: e.clientX, 
          y: e.clientY, 
          actions: binding.value // This is the data you passed to the directive
        }
      })
      window.dispatchEvent(event)
    })
  }
})

app.mount("#app") 
