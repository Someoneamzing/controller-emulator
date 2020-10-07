const socket = io('/controller');
const axis = document.getElementById('axis');
const overlay = document.getElementById('overlay');
const overlayBody = document.getElementById('overlay-body');
const thumb = document.getElementById('thumb');
const led = document.getElementById('connection-led');
const buttons = document.querySelectorAll(".button");
// const interactButton = document.getElementById('button-A');
// const BButton = document.getElementById('button-B');
// const XButton = document.getElementById('button-X');
// const YButton = document.getElementById('button-Y');

socket.on('error', (err)=>{
  overlayBody.innerText = `Could not connect: ${JSON.stringify(err)}`
  overlay.classList.add('shown');
})

window.addEventListener('beforeinstallprompt', (e)=>{
  console.log("Installing prompt");
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(()=>{
    console.log("Service Worker Registered!");
  })
}

let currentAxisTouch = null;

const MID_POS = 0;

function updateAxis(currentTouch) {
  let rect = axis.getBoundingClientRect();
  let xProp = (currentTouch.clientX - (rect.x))/(rect.width);
  let yProp = (currentTouch.clientY - (rect.y))/(rect.height);
  let x = (2 * xProp - 1);
  let y = (2 * yProp - 1);
  let angle = Math.atan2(y, x);
  let maxX = Math.abs(Math.cos(angle)) * .5
  let maxY = Math.abs(Math.sin(angle)) * .5
  x = Math.max(Math.min(maxX,x),-maxX);
  y = Math.max(Math.min(maxY,y),-maxY);
  thumb.style.left = `${(x+1)/2 * 100}%`;
  thumb.style.top = `${(y+1)/2 * 100}%`;
  socket.emit('axis-move', x * 2, -y * 2);
}

socket.on('pong', (ms)=>{
  led.style.backgroundColor = `hsl(${Math.floor(120 - Math.min(120, ms/4))}deg, 100%, 50%)`
})

axis.addEventListener('touchstart', (e)=>{
  e.preventDefault()
  if (currentAxisTouch == null) {
    currentAxisTouch = e.changedTouches[0].identifier;
    let currentTouch = e.changedTouches[0];
    updateAxis(currentTouch)
  }
})

axis.addEventListener('touchmove', (e)=>{
  e.preventDefault()
  let currentTouch = Array.from(e.changedTouches).find(touch=>touch.identifier === currentAxisTouch);
  if (currentTouch) {
    updateAxis(currentTouch)
  }
})

axis.addEventListener('touchend', (e)=>{
  e.preventDefault();
  let currentTouch = Array.from(e.changedTouches).find(touch=>touch.identifier === currentAxisTouch);
  if (currentTouch) {
    currentAxisTouch = null;
    socket.emit('axis-move', MID_POS, MID_POS);
    thumb.style.top = `50%`;
    thumb.style.left = `50%`;
  }
})

axis.addEventListener('touchcancel', (e)=>{
  e.preventDefault();
  let currentTouch = Array.from(e.changedTouches).find(touch=>touch.identifier === currentAxisTouch);
  if (currentTouch) {
    currentAxisTouch = null;
    socket.emit('axis-move', MID_POS, MID_POS);
    thumb.style.top = `50%`;
    thumb.style.left = `50%`;
  }
})

for (let button of buttons) {
  let index = parseInt(button.dataset.button);
  button.addEventListener('touchstart', (e)=>{
    e.preventDefault();
    button.classList.add('pressed')
    socket.emit('button-pressed', index);
  })

  button.addEventListener('touchend', (e)=>{
    e.preventDefault();
    button.classList.remove('pressed')
    socket.emit('button-released', index);
  })
}
