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

        // Obtener imagen
        const response = await fetch(NASA_API);
        const data = await response.json();
        
        // Mostrar imagen
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(data.url)}`;
        img.onload = async () => {
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
        };

    } catch (error) {
        alert('Error cósmico 🚨: ' + error.message);
        document.getElementById('loader').style.display = 'none';
        document.getElementById('generateBtn').disabled = false;
    }
});

function generateSoundtrack(color, audioContext, analyser) {
    // Convertir color a frecuencia
    const frequency = parseInt(color.replace('#', ''), 16) % 2000 + 200;
    
    // Crear oscilador
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Configurar efectos
    const reverb = audioContext.createConvolver();
    
    // Cargar impulso de reverb
    fetch('https://raw.githubusercontent.com/Meruzz/nasa-soundtrack/refs/heads/main/impulse.wav')
        .then(response => response.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .then(decoded => {
            reverb.buffer = decoded;
            oscillator.connect(analyser);
            analyser.connect(reverb);
            reverb.connect(audioContext.destination);
        })
        .catch(error => {
            alert('Error al cargar el archivo de impulso de reverb 🚨: ' + error.message);
        });

    oscillator.start();
    audioContext.resume();

    // Detener después de 30s
    setTimeout(() => {
        oscillator.stop();
        audioContext.close();
    }, 30000);
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