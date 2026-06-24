import axios from 'axios';
import protobuf from 'protobufjs';

// 1. We dynamically define the Spotify Canvas structure here so you don't need any external proto files!
const protoDefinition = `
syntax = "proto3";

message CanvasRequest {
  message Track {
    string track_uri = 1;
  }
  repeated Track tracks = 1;
}

message CanvasResponse {
  message Canvas {
    string id = 1;
    string canvas_url = 2;
    string track_uri = 3;
    string file_id = 4;
  }
  repeated Canvas canvases = 1;
}
`;

// Parse the structure
const root = protobuf.parse(protoDefinition).root;
const CanvasRequest = root.lookupType("CanvasRequest");
const CanvasResponse = root.lookupType("CanvasResponse");

// 2. The main Serverless Function
export default async function handler(req, res) {
  // Allow CORS so you can call this API from anywhere
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { id, token } = req.query;

  if (!id || !token) {
    return res.status(400).json({ success: false, error: "Missing ?id=... or &token=..." });
  }

  // Format the ID correctly
  const trackUri = id.startsWith('spotify:track:') ? id : `spotify:track:${id}`;

  try {
    // Build the Protobuf Request
    const payload = { tracks: [{ track_uri: trackUri }] };
    const message = CanvasRequest.create(payload);
    const requestBytes = CanvasRequest.encode(message).finish();

    // Fetch from Spotify
    const response = await axios.post(
      'https://spclient.wg.spotify.com/canvaz-cache/v0/canvases',
      requestBytes,
      {
        responseType: 'arraybuffer', // Required for Protobuf
        headers: {
          'Accept': 'application/protobuf',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    // Decode the binary response into readable JSON
    const decodedMessage = CanvasResponse.decode(new Uint8Array(response.data));
    const canvasData = CanvasResponse.toObject(decodedMessage, {
      defaults: true,
      arrays: true,
      objects: true
    });

    // Return the final result!
    return res.status(200).json({ success: true, trackId: id, data: canvasData });

  } catch (error) {
    console.error("Canvas API Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to fetch Canvas. Make sure your Spotify token is valid." 
    });
  }
}
