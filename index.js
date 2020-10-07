// const {vJoy, vJoyDevice} = require('vjoy')
const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')

console.log(app, BrowserWindow);

const VGen = require('vgen-xbox');
const vgen = new VGen();

const express = require('express');
const expressApp = express()
const http = require('http').createServer(expressApp);
const io = require('socket.io')(http, {pingInterval: 1000});

let mainWindow = null;
let streamOffer = null;

const controllerConn = io.of('/controller')



function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 200,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('status.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})



const BUTTONS = [];
    BUTTONS[0] = vgen.Buttons.A;
    BUTTONS[1] = vgen.Buttons.B;
    BUTTONS[2] = vgen.Buttons.X;
    BUTTONS[3] = vgen.Buttons.Y;
    BUTTONS[4] = vgen.Buttons.LEFT_SHOULDER;
    BUTTONS[5] = vgen.Buttons.RIGHT_SHOULDER;
    BUTTONS[6] = vgen.Buttons.BACK;
    BUTTONS[7] = vgen.Buttons.START;
    BUTTONS[8] = vgen.Buttons.LEFT_THUMB;
    BUTTONS[9] = vgen.Buttons.RIGHT_THUMB;

ready();


function ready() {
  expressApp.get('/', (req, res)=>{
    res.sendFile(path.join(__dirname, 'index.html'));
  })

  expressApp.use(express.static(__dirname));

  // if (!vJoy.isEnabled()) {
  //   console.log("vJoy is not enabled. Exiting...");
  //   process.exit();
  // }

  function delay(millis) {
    return new Promise(function(resolve, reject) {
      setTimeout(resolve, millis);
    });
  }

  // let device = vJoyDevice.create(1);
  //
  // (async ()=>{
  //   while(true) {
  //     device.buttons[1].set(true);
  //     await delay(1000);
  //     device.buttons[1].set(false);
  //     await delay(1000);
  //   }
  // })()

  function exitHandler(options, exitCode) {
    if (options.cleanup) {
      Array.from(controllerConn.sockets).forEach((socket, i) => {
        vgen.unplug(socket.device);
      });
    }
    if (exitCode || exitCode === 0) console.log(`Process closed with exit code ${exitCode}`);
    if (options.exit) process.exit();
  }

  process.on('exit', exitHandler.bind(null, {cleanup: true}))
  process.on('SIGINT', exitHandler.bind(null, {exit: true}))
  process.on('uncaughtException', exitHandler.bind(null, {exit: true}))


  controllerConn.use((socket, next)=>{
      if (vgen.getNumEmptySlots() <= 0) {
        next(new Error("Too many clients."));
      } else {
        try {
          console.log("Creating device");
          socket.device = vgen.pluginNext();
          next();
        } catch (e) {
          next(e);
        }
      }
  })

  const streamConn = io.of('/stream')

  const viewers = new Map();

  ipcMain.on('stream-offer', (event, {id, offer})=>{
    viewers.get(id).emit('stream-begin', offer, (answer)=>{
      console.log("Answer");
      mainWindow?.send('stream-user-join', {id, answer});
    });
  })

  ipcMain.on('stream-ice-candidate', (event, {id, candidate})=>{
    viewers.get(id).emit('stream-ice-candidate', candidate)
  })

  streamConn.on('connection', (socket)=>{
    viewers.set(socket.id, socket);
    mainWindow.send('new-viewer', socket.id)
    socket.on('viewer-ice-candidate', (candidate)=>{
      mainWindow?.send('viewer-ice-candidate', {id: socket.id, candidate});
    })
    socket.on('disconnect', ()=>viewers.delete(socket.id))
  })

  controllerConn.on('connection', (socket)=>{
    console.log("Socket connected");
    mainWindow?.send('controller-change', {controllerId: socket.device, connected: true})

    socket.on('axis-move', (x, y)=>{
      vgen.setAxisL(socket.device, x, y)
    })

    socket.on('button-pressed', (button)=>{
      vgen.setButton(socket.device, BUTTONS[button], true)
    })

    socket.on('button-released', (button)=>{
      vgen.setButton(socket.device, BUTTONS[button], false)
    })

    socket.on('disconnect', ()=>{
      mainWindow?.send('controller-change', {controllerId: socket.device, connected: false})
      socket.device?vgen.unplug(socket.device):'';
    })
  })

  http.listen(80, ()=>{
    console.log(`Open on 443...`);
  })
}
