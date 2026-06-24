import axios from 'axios';

export default async function handler(req, res) {
  // Allow any site to call this API
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Extract ID and Token from URL: ?id=...&token=...
  const { id, token } = req.query;

  if (!id || !token) {
    return res.status(400).json({ success: false, error: "Missing ?id=YOUR_ID or &token=YOUR_TOKEN in URL" });
  }

  // Auto-format the URI just like Spotify requires
  const trackUri = id.startsWith('spotify:track:') ? id : `spotify:track:${id}`;

  try {
    // Import YOUR original compiled protobuf file
    const { CanvasRequest, CanvasResponse } = (await import('../proto/_canvas_pb.cjs')).default;

    // Build the request exactly as you did in your tests
    const canvasRequest = new CanvasRequest();
    const track = new CanvasRequest.Track();
    track.setTrackUri(trackUri);
    canvasRequest.addTracks(track);

    const requestBytes = canvasRequest.serializeBinary();

    // Fetch from Spotify Canvas API
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

    if (response.status !== 200) {
      return res.status(response.status).json({ success: false, error: "Canvas fetch failed from Spotify" });
    }

    // Decode using your reliable generated protobuf logic
    const parsed = CanvasResponse.deserializeBinary(response.data).toObject();
    
    return res.status(200).json({ success: true, trackId: id, data: parsed });

  } catch (error) {
    console.error("Canvas Request Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to fetch Canvas. Ensure your token is valid." });
  }
}
