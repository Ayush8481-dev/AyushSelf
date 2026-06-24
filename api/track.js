import axios from 'axios';
// STATIC import so Vercel knows 100% to include this file in the deployment
import canvasPb from '../proto/_canvas_pb.cjs';

const { CanvasRequest, CanvasResponse } = canvasPb;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { id, token } = req.query;

  if (!id || !token) {
    return res.status(400).json({ success: false, error: "Missing ?id=YOUR_ID or &token=YOUR_TOKEN in URL" });
  }

  const trackUri = id.startsWith('spotify:track:') ? id : `spotify:track:${id}`;

  try {
    const canvasRequest = new CanvasRequest();
    const track = new CanvasRequest.Track();
    track.setTrackUri(trackUri);
    canvasRequest.addTracks(track);

    const requestBytes = canvasRequest.serializeBinary();

    const response = await axios.post(
      'https://spclient.wg.spotify.com/canvaz-cache/v0/canvases',
      requestBytes,
      {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'application/protobuf',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Language': 'en',
          'User-Agent': 'Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)',
          'Accept-Encoding': 'gzip, deflate, br',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const parsed = CanvasResponse.deserializeBinary(response.data).toObject();
    
    return res.status(200).json({ success: true, trackId: id, data: parsed });

  } catch (error) {
    // CAPTURE THE EXACT ERROR
    let detailedError = error.message;

    // If Axios fails (like a 401 or 403 from Spotify)
    if (error.response) {
      detailedError = `Spotify API Error: Status ${error.response.status}`;
    }

    console.error("Canvas Request Error:", detailedError);
    
    return res.status(500).json({ 
      success: false, 
      error: detailedError,
      hint: "If status is 401, your token is expired or invalid."
    });
  }
}
