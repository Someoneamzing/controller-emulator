self.addEventListener('fetch', (e)=>{
  console.log(e.request.url);
  e.respondWith(fetch(e.request))
})
