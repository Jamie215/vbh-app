window.InitUserScripts = function()
{
var player = GetPlayer();
var object = player.object;
var once = player.once;
var addToTimeline = player.addToTimeline;
var setVar = player.SetVar;
var getVar = player.GetVar;
window.Script1 = function()
{
  const styles = `
    body, * { visibility: hidden; }
    html, body { overflow: hidden; transform: translateZ(0); }
    #slide {
        transform: scale(1) !important;
    }
    #wrapper {
        transform: scale(1) !important;
    }
    #slide,
    #wrapper {
        width: 100% !important;
        height: 100% !important;
        overflow: visible !important;
        break-insdie: avoid-page;
    }
    #frame {
        overflow: visible !important;
    }
    .slide-transition-container {
        overflow: visible !important;
    }
    .scrollarea-area {
    	width: 100% !important;
        height: 100% !important;
        overflow: visible !important;
        break-insdie: avoid-page;
    }
    @page {
        size: A4 portrait;
    }
    .slide-container, .slide-container * {
        visibility: visible !important;
        margin-top: 0px !important;
        margin-left: 0px !important;
    }
    #outline-panel {
        display: none !important;
    }
}
  `
  
    function loadScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        script.onerror = function() {
            console.error('Error loading script:', src);
        };
        document.head.appendChild(script);
    }
		
    const stylesheet = document.createElement('style');
    stylesheet.setAttribute('type', 'text/css');
    stylesheet.innerText = styles;
    document.head.appendChild(stylesheet);
    
	loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function() {
        const element = document.querySelector('.scrollarea-area');
        
        // Ensure the styles are properly applied
        window.getComputedStyle(element);

        html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imgData;
            link.download = 'screenshot.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }).catch(function(error) {
            console.error('Error generating image:', error);
        }).finally(() => {
            document.head.removeChild(stylesheet);
        });
    });
}

};
