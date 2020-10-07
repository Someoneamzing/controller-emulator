const {ipcRenderer, desktopCapturer} = require('electron');
const configuration = require('./streamConfiguration.json');
const controllers = document.querySelectorAll('.controller');
const localStream = document.getElementById('local-stream');


ipcRenderer.on('controller-change', (e, {controllerId, connected})=>{
  console.log(controllerId, connected);
  controllers[controllerId - 1].classList[connected?'add':'remove']('active');
});
let stream;
(async ()=>{
  const sources = await desktopCapturer.getSources({types: ['window', 'screen']})
  console.log(sources);
  let source = sources.find(source=>source.name == "Screen 1");
  console.log(navigator.mediaDevices.getSupportedConstraints());
  stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: 1440,
            minHeight: 900,
            maxWidth: 1440,
            maxHeight: 900,
          },
        }
      });
  localStream.srcObject = stream;
  localStream.onloadedmetadata = (e) => localStream.play()
})()

async function clientJoin(id){
  try {
    console.log("New connection: " + id);

    // localStream.play()
    const peerConnection = new RTCPeerConnection(configuration);
    ipcRenderer.on('stream-user-join', async (event, {id: clientId, answer})=>{
      if (clientId != id) return;
      console.log("New user", answer);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)))
      console.log("Set remote description");
    })


    peerConnection.addTrack(stream.getVideoTracks()[0]);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    peerConnection.addEventListener('connectionstatechange', event=>{
      console.log(peerConnection.connectionState);
      if (peerConnection.connectionState == "connected") {
        console.log("Peers connected");
      }
    })
    window.peerConnection = peerConnection;
    ipcRenderer.send('stream-offer', {id, offer: JSON.stringify(offer)});

    peerConnection.addEventListener('icecandidate', event => {
      console.log("Local candidate", event.candidate);
      if (event.candidate) {
        ipcRenderer.send('stream-ice-candidate', {id, candidate: JSON.stringify(event.candidate)});
      }
    })

    peerConnection.addEventListener('icecandidateerror', (e)=>{
      console.error(e)
    })

    ipcRenderer.on('viewer-ice-candidate', async (event, {id: clientId, candidate})=>{
      if (clientId != id) return;
      console.log("Remote candidate", candidate);
      try {
        await peerConnection.addIceCandidate(candidate)
      } catch (e) {
        console.error("Error adding ice candidate", e);
      }
    })


  } catch (e) {
    console.error(e)
  }

}

ipcRenderer.on('new-viewer', (event, id)=>clientJoin(id))
//"iceServers": [{"urls": "stun:stun.l.google.com:19302"}]
