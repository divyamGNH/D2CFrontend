"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";

type RoomClient = {
  clientId: string;
};

export default function WaitingPage() {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8080";
  const WS_BASE_URL = BASE_URL.replace(/^http/, "ws");
  //   const [roomID, setRoomID] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<unknown[]>([]);
  const targetPeersRef = useRef<string[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [otherPeers, setOtherPeers] = useState<string[]>([]);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerConnectedRef = useRef<Map<string, boolean>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const hasInitializedRef = useRef<boolean>(false);

  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const clientId = searchParams.get("clientId");

  const router = useRouter();

  function getAccessToken() {
    return localStorage.getItem("accessToken");
  }

  function getRefreshToken() {
    return localStorage.getItem("refreshToken");
  }

  function sendMessage(msg: unknown) {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      messageQueueRef.current.push(msg);
      return;
    }

    ws.send(JSON.stringify(msg));
  }

  async function leaveCall() {
    const closeRes = await fetch(
      `${BASE_URL}/leaveroom/${roomId}/${clientId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      },
    );

    return closeRes;
  }

  async function handleLeaveClick() {
    console.log("Leaving the call");
    try {
      await leaveCall();
      wsRef.current?.close();
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to leave room:", error);
    }
  }

  //We did not put this in a try catch as this function is already called up in a try catch block itself and i need all the errors to be handleded by a single catch block.s
  async function setupLocalStream() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some((d) => d.kind === "videoinput");
      console.log(hasCamera);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.log(error);
      throw new Error("setupLocalStream failed", { cause: error });
    }
  }

  async function createPeerConnection(peerId: string) {
    try {
      if (!localStreamRef.current) {
        throw new Error("Local stream not initialized");
      }
      if (!wsRef.current) {
        throw new Error("WebSocket not initialized");
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      });

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendMessage({
            type: "ice",
            payload: event.candidate,
            to: peerId,
          });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRefs.current[peerId]) {
          remoteVideoRefs.current[peerId].srcObject = event.streams[0];
        } else {
          return;
        }
      };

      pcRef.current = pc;
      peerConnectionsRef.current.set(peerId, pc);
      peerConnectedRef.current.set(peerId, false);
      return pc;
    } catch (error) {
      console.log(error);
      throw new Error("Error in creating the Peer Connection", {
        cause: error,
      });
    }
  }

  async function flushPendingIceCandidates(peerId: string) {
    const pc = peerConnectionsRef.current.get(peerId);
    if (!pc || !pc.remoteDescription) {
      return;
    }

    const queued = pendingIceCandidatesRef.current.get(peerId) || [];
    if (queued.length === 0) {
      return;
    }

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Failed to add queued ICE candidate:", error);
      }
    }

    pendingIceCandidatesRef.current.delete(peerId);
  }

  async function queueOrAddIceCandidate(
    peerId: string,
    candidate: RTCIceCandidateInit,
  ) {
    const pc = peerConnectionsRef.current.get(peerId);

    if (!pc || !pc.remoteDescription) {
      const queued = pendingIceCandidatesRef.current.get(peerId) || [];
      queued.push(candidate);
      pendingIceCandidatesRef.current.set(peerId, queued);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }

  //Listen to all the web socket calls in real-time.
  async function setupWebSocketListeners(ws: WebSocket) {
    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      const fromPeerId: string | undefined = message.from;

      switch (message.type) {
        case "offer": {
          if (!fromPeerId || fromPeerId === clientId) {
            break;
          }

          let pc = peerConnectionsRef.current.get(fromPeerId);
          if (!pc) {
            pc = await createPeerConnection(fromPeerId);
          }

          await pc.setRemoteDescription(message.payload);
          await flushPendingIceCandidates(fromPeerId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendMessage({
            type: "answer",
            payload: answer,
            to: fromPeerId,
          });
          break;
        }
        case "answer":
          console.log("answer triggered");
          if (!fromPeerId) {
            break;
          }
          if (peerConnectionsRef.current.get(fromPeerId)) {
            await peerConnectionsRef.current
              .get(fromPeerId)!
              .setRemoteDescription(message.payload);
            await flushPendingIceCandidates(fromPeerId);
            peerConnectedRef.current.set(fromPeerId, true);
          }
          break;

        case "ice":
          console.log("ice triggered");
          if (
            message.payload &&
            fromPeerId &&
            peerConnectionsRef.current.get(fromPeerId)
          ) {
            await queueOrAddIceCandidate(fromPeerId, message.payload);
          }
          break;

        // case "leave":
        //   removePeer(message?.payload?.leftClientId);
        //   break;

        case "signal":
          console.log("Deleting the peer that left");
          if (message?.payload?.action === "leave") {
            removePeer(message?.payload?.leftClientId);
          }
          if (message?.payload?.action === "join") {
            console.log("A new user has joined the room !!");
            console.log(message.payload);

            const joinedPeerId: string | undefined = message?.payload?.newClientId;
            if (!joinedPeerId || joinedPeerId === clientId) {
              break;
            }

            if (!targetPeersRef.current.includes(joinedPeerId)) {
              targetPeersRef.current = [...targetPeersRef.current, joinedPeerId];
            }

            peerConnectedRef.current.set(joinedPeerId, false);
            setOtherPeers((prev) =>
              prev.includes(joinedPeerId) ? prev : [...prev, joinedPeerId],
            );
          }
          break;
      }
    };
  }

  const settingRTCEnvironment = async () => {
    try {
      // Validate required parameters
      if (!roomId || !clientId) {
        console.error("Missing roomId or clientId from URL params");
        throw new Error(
          `Invalid URL params: roomId=${roomId}, clientId=${clientId}`,
        );
      }

      if (!getAccessToken()) {
        console.error("No access token in localStorage");
        throw new Error("Access token required");
      }

      await setupLocalStream();
      if (!localStreamRef.current) return;

      // Set up the WebSocket connection
      const wsUrl = `${WS_BASE_URL}/ws/${roomId}/${clientId}?token=${getAccessToken()}`;
      console.log("Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set up error handler BEFORE any other handlers
      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        // Check if connection was refused
        if (event instanceof Event && event.type === "error") {
          console.error(
            `Failed to connect to WebSocket. Make sure backend is running on ${BASE_URL}`,
          );
        }
      };

      ws.onclose = async () => {
        // const closeRes = await leaveCall();
        // await closeRes.json();

        console.log("WebSocket disconnected");
      };

      // Set up open handler
      ws.onopen = async () => {
        messageQueueRef.current.forEach((msg) => {
          ws.send(JSON.stringify(msg));
        });
        messageQueueRef.current = [];

        console.log("WebSocket connected successfully");

        targetPeersRef.current.forEach((peerId) => {
          void ensurePeerConnection(peerId);
        });
      };

      // Set up all the WS listeners
      await setupWebSocketListeners(ws);

      let response;

      console.log("fetching other peers");
      const res = await fetch(`${BASE_URL}/viewroom/${roomId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (res.status === 401) {
        console.log("Token expired trying to refresh");
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refreshToken: getRefreshToken(),
          }),
        });

        if (!refreshRes.ok) {
          const txt = await refreshRes.text();
          throw new Error(`Refresh failed ${refreshRes.status}: ${txt}`);
        }

        const refreshedData = await refreshRes.json();
        console.log("Token refreshed");

        localStorage.setItem("accessToken", refreshedData.accessToken);
        localStorage.setItem("refreshToken", refreshedData.refreshToken);

        const retryRes = await fetch(`${BASE_URL}/viewroom/${roomId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshedData.accessToken}`,
          },
        });

        response = await retryRes.json();
      } else {
        response = await res.json();
      }

      console.log("fetched other peers");

      const targetPeers = (
        (response?.clients as RoomClient[] | undefined) || []
      )
        .filter((p) => p.clientId !== clientId)
        .map((p) => p.clientId);

      targetPeersRef.current = targetPeers;
      setOtherPeers(targetPeers);
      console.log(targetPeers);

      if (ws.readyState === WebSocket.OPEN) {
        targetPeers.forEach((peerId) => {
          void ensurePeerConnection(peerId);
        });
      }
    } catch (error) {
      console.error("Error setting up RTC environment:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
    }
  };

  const ensurePeerConnection = async (peerId: string) => {
    if (!peerId || peerId === clientId) {
      return;
    }
    if (peerConnectionsRef.current.get(peerId)) {
      return;
    }

    const pc = await createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendMessage({
      type: "offer",
      payload: offer,
      to: peerId,
    });
  };

  const removePeer = (leftClientId: string) => {
    if (!leftClientId) return;

    const leavePc = peerConnectionsRef.current.get(leftClientId);
    if (leavePc) {
      leavePc.onicecandidate = null;
      leavePc.ontrack = null;
      leavePc.onconnectionstatechange = null;
      leavePc.close();
    }

    delete remoteVideoRefs.current[leftClientId];
    peerConnectionsRef.current.delete(leftClientId);
    peerConnectedRef.current.delete(leftClientId);
    pendingIceCandidatesRef.current.delete(leftClientId);
    targetPeersRef.current = targetPeersRef.current.filter(
      (peerId) => peerId !== leftClientId,
    );
    setOtherPeers((prev) => prev.filter((peerId) => peerId !== leftClientId));

    console.log(
      `Cleaned up after the client with clientId : ${leftClientId} left the room`,
    );
  };

  useEffect(() => {
    try {
      if(hasInitializedRef.current) return;
      hasInitializedRef.current = true;
      settingRTCEnvironment();
    } catch (error) {
      console.log("Error setting up the RTC environment :", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    otherPeers.forEach((peerId) => {
      if (!peerId || peerId === clientId) return;
      if (peerConnectedRef.current.get(peerId)) return;

      void ensurePeerConnection(peerId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherPeers, clientId]);

  useEffect(()=>{
    function handleLeave(){
      if(!clientId) return;

      //Send a socket event to all other peers;
      sendMessage({
        type:"signal",
        payload:{
          action : "leave",
          //leaving clientId, roomId
        }
        // to:
      });

      peerConnectionsRef.current.forEach((pc)=>{
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onsignalingstatechange = null;
        pc.close();
      });

      peerConnectedRef.current.clear();
      peerConnectionsRef.current.clear();
    }

    window.addEventListener("pagehide", handleLeave);

    return ()=>{
      window.removeEventListener("pagehide", handleLeave);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    return()=>{
      if(!wsRef.current) return;
      wsRef.current.onopen = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      
      wsRef.current.close();
      wsRef.current = null;
    }
  },[])

  const shortId = (id: string | null) => {
    if (!id) return "unknown";
    if (id.length <= 10) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-18 top-20 h-56 w-56 rounded-full border border-cyan-400/20" />
      <div className="pointer-events-none absolute -right-20 bottom-12 h-60 w-60 rounded-full border border-indigo-400/20" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-4 shadow-xl shadow-black/30 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Room Session</p>
              <p className="mt-1 font-mono text-sm text-cyan-200 sm:text-base">{roomId || "unknown"}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Live
              </span>
              <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                Peers: {otherPeers.length}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-700/70 pt-4">
            <div className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 sm:text-sm">
              You: <span className="font-mono text-slate-100">{shortId(clientId)}</span>
            </div>

            <button
              onClick={() => {
                void handleLeaveClick();
              }}
              className="ml-auto rounded-md border border-rose-400/50 bg-rose-400/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:scale-[1.02] hover:bg-rose-400/25"
            >
              Leave Room
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl border border-cyan-400/35 bg-slate-900 shadow-lg shadow-cyan-950/20 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/60">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-64 w-full object-cover sm:h-72"
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 rounded-md border border-cyan-300/40 bg-black/60 px-2.5 py-1 text-xs font-medium text-cyan-100">
              You | {shortId(clientId)}
            </div>
          </div>

          {otherPeers.map((peerId) => (
            <div
              key={peerId}
              className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-lg shadow-black/30 transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300/55"
            >
              <video
                ref={(el) => {
                  remoteVideoRefs.current[peerId] = el;
                }}
                autoPlay
                playsInline
                className="h-64 w-full object-cover sm:h-72"
              />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3 rounded-md border border-indigo-300/35 bg-black/60 px-2.5 py-1 text-xs font-medium text-slate-100">
                Peer | {shortId(peerId)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
