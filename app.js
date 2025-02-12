const CONFIG = {
    NASA_API_KEY: 'Nctp77oPbZ6N5JSyn3xuYM0A4s8axg45FYsPKLli',
    PROXIES: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ]
};

const NASA_API = `https://api.nasa.gov/planetary/apod?api_key=${CONFIG.NASA_API_KEY}&count=1&thumbs=true`;

document.getElementById('generateBtn').addEventListener('click', async () => {
    try {
        const btn = document.getElementById('generateBtn');
        const loader = document.getElementById('loader');
        const imageContainer = document.getElementById('imageContainer');
        const audioPlayer = document.getElementById('audioPlayer');
        
        btn.disabled = true;
        loader.style.display = 'block';
        imageContainer.innerHTML = '';

        // Fetch NASA APOD data
        let data = await fetchWithRetry(NASA_API, 3);
        data = Array.isArray(data) ? data[0] : data; // Si es un array, tomar el primer elemento

        // Si es un video, volver a intentar hasta obtener una imagen
        let attempts = 0;
        while (data.media_type === 'video' && attempts < 3) {
            console.log('Received video, trying again for an image...');
            data = await fetchWithRetry(NASA_API, 3);
            data = Array.isArray(data) ? data[0] : data;
            attempts++;
        }

        if (data.media_type === 'video') {
            throw new Error('No se pudo obtener una imagen después de varios intentos');
        }

        console.log('NASA API Response:', data); // Debug log

        if (!data) {
            throw new Error('No se recibió respuesta de la API de NASA');
        }

        // Verificar el tipo de medio
        if (data.media_type === 'video') {
            // Crear un iframe para videos
            const iframe = document.createElement('iframe');
            iframe.width = "560";
            iframe.height = "315";
            iframe.src = data.url;
            iframe.frameBorder = "0";
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            imageContainer.appendChild(iframe);

            // Usar un color predeterminado para videos
            const defaultColor = '#4A90E2';
            
            // Configure audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = initVisualizer(audioContext);
            generateSoundtrack(defaultColor, audioContext, analyser);
            
            const mediaStreamDestination = audioContext.createMediaStreamDestination();
            audioPlayer.srcObject = mediaStreamDestination.stream;
            audioPlayer.style.visibility = 'visible';
        } else {
            // Manejar imágenes como antes
            const mediaUrl = data.hdurl || data.url;
            console.log('Loading image:', mediaUrl);
            
            const img = await loadImage(mediaUrl);
            imageContainer.appendChild(img);
            
            // Analyze color
            const palette = await Vibrant.from(img).getPalette();
            const mainColor = palette.Vibrant?.getHex() || '#FFFFFF';
            
            // Configure audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = initVisualizer(audioContext);
            generateSoundtrack(mainColor, audioContext, analyser);
            
            const mediaStreamDestination = audioContext.createMediaStreamDestination();
            audioPlayer.srcObject = mediaStreamDestination.stream;
            audioPlayer.style.visibility = 'visible';
        }

        loader.style.display = 'none';
        btn.disabled = false;
        document.getElementById('audioPlayer').hidden = false;

    } catch (error) {
        console.error('Error:', error);
        alert('Error cósmico 🚨: ' + error.message);
        document.getElementById('loader').style.display = 'none';
        document.getElementById('generateBtn').disabled = false;
    }
});

async function fetchWithRetry(url, retries) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
}

async function loadImage(url) {
    // Intentar cargar la imagen directamente primero
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
        return img;
    } catch (error) {
        console.log('Direct image load failed, trying proxies...');
        
        // Si falla, intentar con cada proxy
        for (const proxy of CONFIG.PROXIES) {
            try {
                const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
                console.log('Trying proxy:', proxyUrl);
                
                const response = await fetch(proxyUrl);
                const blob = await response.blob();
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = URL.createObjectURL(blob);
                });
                
                return img;
            } catch (error) {
                console.log('Proxy failed:', proxy);
                continue;
            }
        }
        
        throw new Error('Failed to load image through all available methods');
    }
}

async function loadImageWithRetry(img, url, retries) {
    for (let i = 0; i < retries; i++) {
        try {
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = (e) => {
                    console.warn(`Image load attempt ${i + 1} failed:`, e);
                    reject(new Error('Failed to load image'));
                };
                img.src = url;
            });
            return;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
}

function generateSoundtrack(color, audioContext, analyser) {
    // Convertir color hexadecimal a componentes RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Crear nodo de ganancia master
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
    
    // Crear múltiples osciladores basados en RGB
    const oscillators = [
        createOscillator(r, 'sine', 0.3),     // Frecuencia base del rojo
        createOscillator(g, 'triangle', 0.2),  // Armónicos del verde
        createOscillator(b, 'square', 0.1)     // Texturas del azul
    ];
    
    // Crear filtros
    const lowPassFilter = audioContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.setValueAtTime(2000, audioContext.currentTime);
    
    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.setValueAtTime(100, audioContext.currentTime);
    
    // Crear delay para efecto espacial
    const delay = audioContext.createDelay();
    delay.delayTime.setValueAtTime(0.3, audioContext.currentTime);
    
    const delayGain = audioContext.createGain();
    delayGain.gain.setValueAtTime(0.2, audioContext.currentTime);
    
    // Función helper para crear osciladores
    function createOscillator(colorValue, type, gainValue) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        // Mapear valor de color (0-255) a frecuencia (100-1000Hz)
        const frequency = (colorValue / 255) * 900 + 100;
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        // Aplicar envolvente ADSR
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(gainValue, audioContext.currentTime + 0.1);  // Attack
        gain.gain.linearRampToValueAtTime(gainValue * 0.7, audioContext.currentTime + 0.3);  // Decay
        gain.gain.linearRampToValueAtTime(gainValue * 0.5, audioContext.currentTime + 15);   // Sustain
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 29);  // Release
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start();
        return osc;
    }
    
    // Crear LFO para modulación
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.frequency.setValueAtTime(0.5, audioContext.currentTime);
    lfoGain.gain.setValueAtTime(50, audioContext.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(lowPassFilter.frequency);
    lfo.start();
    
    // Conectar todo
    masterGain.connect(lowPassFilter);
    lowPassFilter.connect(highPassFilter);
    highPassFilter.connect(analyser);
    
    // Ruta del delay
    highPassFilter.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(analyser);
    
    // Conectar al destino final
    analyser.connect(audioContext.destination);
    
    // Detener todo después de 30s
    setTimeout(() => {
        oscillators.forEach(osc => {
            osc.stop();
        });
        lfo.stop();
        audioContext.close();
    }, 30000);
    
    return masterGain; // Retornamos el nodo master para posible control posterior
}

function initVisualizer(audioContext) {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    canvas.width = 800;
    canvas.height = 200;

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0B3D91';

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height/2;

            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height/2);
        ctx.stroke();
    }
    
    draw();
    return analyser;
}