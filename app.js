// Reemplaza DEMO_KEY con tu API key
const NASA_API = 'https://api.nasa.gov/planetary/apod?api_key=Nctp77oPbZ6N5JSyn3xuYM0A4s8axg45FYsPKLli';

document.getElementById('generateBtn').addEventListener('click', async () => {
    try {
        const btn = document.getElementById('generateBtn');
        const loader = document.getElementById('loader');
        const imageContainer = document.getElementById('imageContainer');
        const audioPlayer = document.getElementById('audioPlayer');
        
        btn.disabled = true;
        loader.style.display = 'block';
        imageContainer.innerHTML = '';

        // Obtener imagen con reintentos
        const data = await fetchWithRetry(NASA_API, 3);
        
        // Mostrar imagen con reintentos
        const imgUrl = `https://thingproxy.freeboard.io/fetch/${data.url}`;
        const img = new Image();
        img.crossOrigin = "Anonymous";
        await loadImageWithRetry(img, imgUrl, 3);
        imageContainer.appendChild(img);
        
        // Analizar color
        const palette = await Vibrant.from(img).getPalette();
        const mainColor = palette.Vibrant?.getHex() || '#FFFFFF';
        
        // Configurar audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = initVisualizer(audioContext);
        generateSoundtrack(mainColor, audioContext, analyser);
        
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        audioPlayer.srcObject = mediaStreamDestination.stream;
        audioPlayer.style.visibility = 'visible';

        loader.style.display = 'none';
        btn.disabled = false;
        document.getElementById('audioPlayer').hidden = false;

    } catch (error) {
        alert('Error cósmico 🚨: ' + error.message);
        document.getElementById('loader').style.display = 'none';
        document.getElementById('generateBtn').disabled = false;
    }
});

async function fetchWithRetry(url, retries) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
        }
    }
}

async function loadImageWithRetry(img, url, retries) {
    for (let i = 0; i < retries; i++) {
        try {
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
            return;
        } catch (error) {
            if (i === retries - 1) throw error;
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