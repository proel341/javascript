"use strict";

var SimpleIceCandidate = (iceCandidate) => ({
    candidate: iceCandidate.candidate,
    sdpMid: iceCandidate.sdpMid,
    sdpMLineIndex: iceCandidate.sdpMLineIndex
});

var createIceCandidateHandler = () => {
    var candidates = new Array();

    var {
        promise: handlingResult,
        resolve: finishCandidateHandling,
        reject: failCandidateHandling
    } = Promise.withResolvers();

    return {
        0: handlingResult,
        1: (event) => {
            try {
                var candidate = event.candidate;
                if (candidate) candidates.push(SimpleIceCandidate(candidate));
                else finishCandidateHandling(candidates);
            }
            catch (error) {
                failCandidateHandling(error);
            }
        }
    }
}

var applyAnswerWithCandidates = (peerConnection) => (answer, remoteIceCandidates) => (
    Promise.all([
        peerConnection.setRemoteDescription(answer),
        remoteIceCandidates.reduce((p, c) => p.then(() => peerConnection.addIceCandidate(c)), Promise.resolve())
    ])
)

var createOfferWithCandidates = (peerConnection, iceCandidatesPromise) => () => (
    peerConnection.createOffer()
        .then(offer => Promise.all([ peerConnection.setLocalDescription(offer), iceCandidatesPromise ])
        .then(({1: iceCandidates}) => ({ 0: offer, 1: iceCandidates }))
    )
);

var createAnswerWithCandidates = (peerConnection, iceCandidatesPromise) => (offer, remoteIceCandidates) => (
    Promise.all([
        peerConnection.setRemoteDescription(offer),
        remoteIceCandidates.reduce( (p, c) => p.then(() => peerConnection.addIceCandidate(c)), Promise.resolve() )
    ]).then(() => peerConnection.createAnswer())
    .then(answer => Promise.all([peerConnection.setLocalDescription(answer), iceCandidatesPromise])
        .then(({1: iceCandidates}) => ({0: answer, 1: iceCandidates}))
    )
);

var createWebRtcConnection = () => {
    var peerConnection = new RTCPeerConnection();
    var dataChannel = null;
    var {0: iceCandidatesPromise, 1: onIceCandidate} = createIceCandidateHandler();
    var {
        promise: channelPromise,
        resolve: setChannel,
        reject: failSetChannel
    } = Promise.withResolvers();

    peerConnection.onicecandidate = onIceCandidate;
    peerConnection.ondatachannel = (event) => {
        var ch = event.channel
        try {
            if (!dataChannel && ch) {
                dataChannel = ch;
                setChannel(ch);
            }
        } catch (error) {
            failSetChannel(error);
        }
    };

    return {
        createOfferWithCandidates: createOfferWithCandidates(peerConnection, iceCandidatesPromise),
        createAnswerWithCandidates: createAnswerWithCandidates(peerConnection, iceCandidatesPromise),
        applyAnswerWithCandidates: applyAnswerWithCandidates(peerConnection),
        createDataChannel: (identifier) => { 
            dataChannel = peerConnection.createDataChannel(identifier);
            setChannel(dataChannel);
        },
        getDataChannel: () => channelPromise
    }
}


// ==== USAGE EXAMPLE =====

window.addEventListener("load", () => {

    document.querySelector('#app').innerHTML = `  
        <div style="display: flex; flex-direction: column;">
          <textarea></textarea>
          <input type="text">
          <button id="send">Send!</button>
        </div>
        <div style="display: flex; flex-direction: column;">
          <button id="createOfferBtn">CreateOffer</button>
          <span id="offer"></span>
          <textarea id="conn"></textarea>
          <button id="createAnswerBtn">CreateAnswer</button>
          <span id="answer"></span>
          <textarea id="connA"></textarea>
        </div>
          <button id="applyAnswerBtn">ApplyAnswer</button>
    `;

    var rtc = createWebRtcConnection();

    rtc.getDataChannel().then(channel => {
        console.log(channel);
        channel.onclose = (...args) => console.log(...args);
        channel.onopen = (...args) => console.log(...args);
        channel.onmessage = (...args) => console.log(...args);

        var btn = document.getElementById("send");
        btn.onclick = () => {
            console.log("sending...")
            channel.send("hello");
        }
    });

    var createOfferBtn = document.getElementById('createOfferBtn');
    var createAnswerBtn = document.getElementById("createAnswerBtn");
    var applyAnswerBtn = document.getElementById("applyAnswerBtn");

    var offerEl = document.getElementById("offer");
    var answerEl = document.getElementById("answer");

    var connEl = document.getElementById("conn");
    var connAEl = document.getElementById("connA");

    createOfferBtn.onclick = () => {
        rtc.createDataChannel("helloWorld");
        rtc.createOfferWithCandidates().then(
            ({ 0: o, 1: cs }) => {
                var data = JSON.stringify({o,cs});
                offerEl.innerHTML = data;
            }
        );
    }

    createAnswerBtn.onclick = () => {
        var {o: offer, cs: iceCandidates} = JSON.parse(connEl.value)
        rtc.createAnswerWithCandidates(offer, iceCandidates).then(
            ({0: a, 1: cs}) => {
                var data = JSON.stringify({a,cs});
                answerEl.innerHTML = data;
            }
        );
    }

    applyAnswerBtn.onclick = () => {
        var {a: answer, cs: iceCandidates} = JSON.parse(connAEl.value);
        rtc.applyAnswerWithCandidates(answer, iceCandidates);
    }

    
})
