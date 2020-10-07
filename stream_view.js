// const configuration = JSON.parse(document.getElementById('config').text);
const canvas = document.getElementById('stream');
const socket = io('/stream', {autoConnect: false});

(async ()=>{
  let configuration = await (await fetch('/streamConfiguration.json')).json();
  const peerConnection = new RTCPeerConnection(configuration);
  socket.on('stream-begin', async (offer,ack) => {
    console.log("Stream begin");
    peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ack(JSON.stringify(answer));

  })

  socket.on('stream-ice-candidate', async (candidate)=>{
    console.log("Candidate");
    try {
      await peerConnection.addIceCandidate(JSON.parse(candidate))
    } catch (e) {
      console.error("Error adding ice candidate", e);
    }
  })

  peerConnection.addEventListener('icecandidate', event => {
    console.log("local Candidate");
    if (event.candidate) {
      socket.emit('viewer-ice-candidate', event.candidate);
    }
  })

  peerConnection.addEventListener('connectionstatechange', event=>{
    console.log(peerConnection.connectionState);
    if (peerConnection.connectionState == "connected") {
      console.log("Peers connected");
    }
  })

  peerConnection.addEventListener('track', async (e)=>{
    console.log("Play Stream");
    const remoteStream = new MediaStream();
    canvas.srcObject =  remoteStream;
    remoteStream.addTrack(e.track);
    canvas.onloadedmetadata = (e) => {canvas.onclick= ()=> canvas.play()}

  })

  socket.connect('/stream')
})()
