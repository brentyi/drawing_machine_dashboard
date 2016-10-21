// needs to be built to "build/window.js" with browserify
// > browserify window.js -o build/window.js


// Serial communication

var SerialPortLib = require('browser-serialport');
var SerialPort = SerialPortLib.SerialPort;

var port;

SerialPortLib.list(function(err, ports) {
    var portsPath = $('#portPath').get(0);

    if (err) {
        console.log('Error listing ports', err);
        portsPath.options[0] = new Option(err, 'ERROR:' + err);
        portsPath.options[0].selected = true;
        return;
    } else {
        for (var i = 0; i < ports.length; i++) {
            portsPath.options[i] = new Option(ports[i].comName, ports[i].comName);

            if (ports[i].comName.toLowerCase().indexOf('usb') !== -1) {
                portsPath.options[i].selected = true;
            }
        }

        $('#connect').click(function() {
            if (port) {
                port.close();
                port = undefined;
                $('#connect').text('Connect');
                return;
            }
            var path = $('#portPath').val();
            var baudrate = 115200;
            connect(path, baudrate);
        });
    }
});


function outputlog(s) {
    $output = $('#output');
    val = $output.val();
    if (val.length > 3000) { //questionable efficiency
        val = val.substr(val.length - 1500);
    }
    $output.val(val + s);
    $output.scrollTop($output[0].scrollHeight);
}

function send() {
    if (!$('#input').val()) {
        outputlog("\n");
        return;
    }
    $input = $('#input');
    line = $input.val().trim() + '\n';

    port.write(line);
    $input.val('');
    outputlog('\n>> ' + line);
}

function connect(path, baud) {
    $('#output').val('Connecting... ');

    port = new SerialPort(path, {
        baudrate: baud,
        buffersize: 65536
    }, true);

    port.on('open', function() {
        $('body').addClass('connected');
        outputlog('DONE\n');
        $('#connect').text('Disconnect');
    });

    port.on('close', function(string) {
        outputlog('\nClosing: ' + string + '\n');
        $('body').removeClass('connected');
        port = undefined;
    });

    port.on('error', function(string) {
        outputlog('\nError: ' + string + '\n');
        port.close();
    });

    port.on('data', function(data) {
        s = data.toString();

        outputlog(s);
        if ($('body').is('.running') && (s.includes('\nok') || s.startsWith('ok'))) {
            ready();
        }
    });

    var input = document.getElementById('input');

    $('#input').keypress(function(e) {
        if (e.which == 13) {
            e.preventDefault();
            send();
        }
    });
    $('#send').click(function(e) {
        send();
    });
}



/// G-Code handling

var gcode_buffer;
var gcode_index = 0;

addEventListener('dragover', function(e){e.preventDefault();});
addEventListener('drop', function(e) {
    eventHandler.call((e.dataTransfer||e.clipboardData));
    e.preventDefault();
});

function eventHandler() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.onloadend = callbackFn;
    reader.readAsText(file);
    if (this.id) { //only run if this is the input
        var id = this.id;
        this.outerHTML = this.outerHTML; //this resets the input
        document.getElementById(id).addEventListener('change', eventHandler);
    }
}

function callbackFn(e) {
    //document.getElementById('output').value = e.target.result;
    gcode_buffer = e.target.result.split('\n');
    $('body').addClass('gcode_loaded');
    outputlog("G-Code loaded");
    gcode_index = 0;
}

$('#run').click(function() {
    $('body').addClass('running');
    port.flush();
    ready();
});

$('#stop').click(function() {
    gcode_index = 0;
    $('body').removeClass('running');
});

function ready() {
    if (!gcode_buffer || !$('body').is('.running')) {
        $('body').removeClass('running');
        return;
    }

    if (gcode_index == gcode_buffer.length) {
        $('#stop').click();
        return;
    }

    if (!gcode_buffer[gcode_index] || gcode_buffer[gcode_index].startsWith('\;')) {
        gcode_index++;
        ready();
        return;
    }

    $('#input').val(gcode_buffer[gcode_index++]);
    send();
    $('#input').val(gcode_buffer[gcode_index]);

    $('#progress .inner').css('width', (gcode_index / gcode_buffer.length * 100) + '%');
}

$('#upload').change(eventHandler);
