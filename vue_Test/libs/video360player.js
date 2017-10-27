
var Detector = {

  canvas: !!window.CanvasRenderingContext2D,
  webgl: (function() {
    try {
      var canvas = document.createElement('canvas');
      return !!window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  })(),
  workers: !!window.Worker,
  fileapi: window.File && window.FileReader && window.FileList && window.Blob,

  getWebGLErrorMessage: function() {

    var element = document.createElement('div');
    element.id = 'webgl-error-message';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '13px';
    element.style.fontWeight = 'normal';
    element.style.textAlign = 'center';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.padding = '1.5em';
    element.style.width = '400px';
    element.style.margin = '5em auto 0';

    if (!this.webgl) {

      element.innerHTML = window.WebGLRenderingContext ? [
        'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
        'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'
      ].join('\n') : [
        'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>',
        'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'
      ].join('\n');

    }

    return element;

  },

  addGetWebGLMessage: function(parameters) {

    var parent, id, element;

    parameters = parameters || {};

    parent = parameters.parent !== undefined ? parameters.parent : document.body;
    id = parameters.id !== undefined ? parameters.id : 'oldie';

    element = Detector.getWebGLErrorMessage();
    element.id = id;

    parent.appendChild(element);

  }



;
(function($, THREE, Detector, window, document, undefined) {

  // undefined is used here as the undefined global
  // variable in ECMAScript 3 and is mutable (i.e. it can
  // be changed by someone else). undefined isn't really
  // being passed in so we can ensure that its value is
  // truly undefined. In ES5, undefined can no longer be
  // modified.

  // window and document are passed through as local
  // variables rather than as globals, because this (slightly)
  // quickens the resolution process and can be more
  // efficiently minified (especially when both are
  // regularly referenced in your plugin).

  // Create the defaults once
  var pluginName = "teleCap360",
    plugin, // will hold reference to instantiated Plugin
    defaults = {
      crossOrigin: 'anonymous',
      clickAndDrag: false,
      keyboardControls: true,
      fov: 35,
      fovMin: 3,
      fovMax: 100,
      hideControls: false,
      lon: 0,
      lat: 0,
      offsetT: 0,
      frameC: -1,
      frameUpdated: false,
      loop: "loop",
      muted: true,
      volume: 1,
      debug: false,
      flatProjection: false,
      autoplay: true,
      tc_globalViewQua: globalViewQua_,
      tc_curIdx: 0,
      width=800,height=600
    };

  // The actual plugin constructor
  function Plugin(element, options) {
    this.element = element;

    // jQuery has an extend method that merges the
    // contents of two or more objects, storing the
    // result in the first object. The first object
    // is generally empty because we don't want to alter
    // the default options for future instances of the plugin
    this.options = $.extend({}, defaults, options);

    this._defaults = defaults;
    this._name = pluginName;

    this.init();
  }

  Plugin.prototype = {

    init: function() {
      // Place initialization logic here
      // You already have access to the DOM element and
      // the options via the instance, e.g. this.element
      // and this.options
      // you can add more functions like the one below and
      // call them like so: this.yourOtherFunction(this.element, this.options).

      // instantiate some local variables we're going to need
      this._time = new Date().getTime();
      this._timeX = 0;
      this._controls = {};
      this._id = this.generateUUID();

      this._requestAnimationId = ''; // used to cancel requestAnimationFrame on destroy
      this._isVideo = false;
      this._isPhoto = false;
      this._isFullscreen = false;
      this._mouseDown = false;
      this._dragStart = {};

      this._lat = this.options.lat;
      this._lon = this.options.lon;
      this._fov = this.options.fov;


      this.createMediaPlayer();
      this.createControls();

    },

    generateUUID: function() {
      var d = new Date().getTime();
      var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x7 | 0x8)).toString(16);
      });
      return uuid;
    },

    createMediaPlayer: function() {

      // make a self reference we can pass to our callbacks
      var self = this;

      // create a local THREE.js scene
      this._scene = new THREE.Scene();

      // create ThreeJS camera
      this._camera = new THREE.PerspectiveCamera(this._fov, this.width / this.height, 0.1, 1000);
      this._camera.setLens(this._fov);

      // create ThreeJS renderer and append it to our object
      this._renderer = Detector.webgl ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer();
      //this._renderer.setSize($(this.element).width(), $(this.element).height());
      this._renderer.setSize( this.width , this.height);
      this._renderer.autoClear = false;
      this._renderer.setClearColor(0x333333, 1);

      // append the rendering element to this div
      //$(this.element).append(this._renderer.domElement);

      var createAnimation = function() {
        self._texture.generateMipmaps = false;
        self._texture.minFilter = THREE.LinearFilter;
        self._texture.magFilter = THREE.LinearFilter;
        self._texture.format = THREE.RGBFormat;

        // create ThreeJS mesh sphere onto which our texture will be drawn
        self._mesh = new THREE.Mesh(new THREE.SphereGeometry(498, 80, 50), new THREE.MeshBasicMaterial({
          map: self._texture
        }));
        self._mesh.scale.x = -1; // mirror the texture, since we're looking from the inside out
        self._scene.add(self._mesh);

        self.animate();
      };

      // figure out our texturing situation, based on what our source is
      if ($(this.element).attr('data-photo-src')) {
        this._isPhoto = true;
        THREE.ImageUtils.crossOrigin = this.options.crossOrigin;
        this._texture = THREE.ImageUtils.loadTexture($(this.element).attr('data-photo-src'));
        createAnimation();
      } else {
        this._isVideo = true;

        // create loading overlay
        var loadingHTML = '<div class="loading"> \
										<div class="icon waiting-icon"></div> \
										<div class="icon error-icon"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i></div> \
									</div>';
        $(this.element).append(loadingHTML);
        this.showWaiting();

        // create off-dom video player
        this._video = document.createElement('video');
        this._video.setAttribute('crossorigin', this.options.crossOrigin);
        this._video.style.display = 'none';
        $(this.element).append(this._video);
        this._video.loop = this.options.loop;
        this._video.muted = this.options.muted;
        this._video.volume = this.options.volume;

        // attach video player event listeners
        this._video.addEventListener("ended", function() {

        });

        // Progress Meter
        this._video.addEventListener("progress", function() {
          var percent = null;
          if (self._video && self._video.buffered && self._video.buffered.length > 0 && self._video.buffered.end && self._video.duration) {
            console.log("buffered.end(0)");
            percent = self._video.buffered.end(0) / self._video.duration;
          }
          // Some browsers (e.g., FF3.6 and Safari 5) cannot calculate target.bufferered.end()
          // to be anything other than 0. If the byte count is available we use this instead.
          // Browsers that support the else if do not seem to have the bufferedBytes value and
          // should skip to there. Tested in Safari 5, Webkit head, FF3.6, Chrome 6, IE 7/8.
          else if (self._video && self._video.bytesTotal !== undefined && self._video.bytesTotal > 0 && self._video.bufferedBytes !== undefined) {
            console.log("self._video.bufferedBytes");
            percent = self._video.bufferedBytes / self._video.bytesTotal;
          }

          // Someday we can have a loading animation for videos
          var cpct = Math.round(percent * 100);
          if (cpct === 100) {
            // do something now that we are done
          } else {
            // do something with this percentage info (cpct)
          }
        });
        // Error listener
        this._video.addEventListener('error', function(event) {
          console.error(self._video.error);
          self.showError();
        });

        this._video.addEventListener("timeupdate", function() {
          if (this.paused === false) {
            var percent = this.currentTime * 100 / this.duration;
            $(self.element).find('.controlsWrapper > .valiant-progress-bar')[0].children[0].setAttribute("style", "width:" + percent + "%;");
            $(self.element).find('.controlsWrapper > .valiant-progress-bar')[0].children[1].setAttribute("style", "width:" + (100 - percent) + "%;");
            //Update time label
            var durMin = Math.floor(this.duration / 60);
            var durSec = Math.floor(this.duration - (durMin * 60));
            var timeMin = Math.floor(this.currentTime / 60);
            var timeSec = Math.floor(this.currentTime - (timeMin * 60));
            var duration = durMin + ':' + (durSec < 10 ? '0' + durSec : durSec);
            var currentTime = timeMin + ':' + (timeSec < 10 ? '0' + timeSec : timeSec);
            $(self.element).find('.controls .timeLabel').html(currentTime + ' / ' + duration);
          }
        });

        // IE 11 and previous not supports THREE.Texture([video]), we must create a canvas that draws the video and use that to create the Texture
        var isIE = navigator.appName == 'Microsoft Internet Explorer' || !!(navigator.userAgent.match(/Trident/) || navigator.userAgent.match(/rv 11/));
        this._testcanvas = document.createElement('canvas');
        if (isIE) {
          this._videocanvas = document.createElement('canvas');
          this._texture = new THREE.Texture(this._videocanvas);
          // set canvas size = video size when known
          this._video.addEventListener('loadedmetadata', function() {
            self._videocanvas.width = self._video.videoWidth;
            self._videocanvas.height = self._video.videoHeight;
            createAnimation();
          });
        } else {
          this._texture = new THREE.Texture(this._video);
        }

        //force browser caching of the video to solve rendering errors with big videos
        var xhr = new XMLHttpRequest();
        xhr.open('GET', $(this.element).attr('data-video-src'), true);
        xhr.responseType = 'blob';
        xhr.onload = function(e) {
          if (this.status === 200) {
            var vid = (window.webkitURL ? webkitURL : URL).createObjectURL(this.response);
            //Video Play Listener, fires after video loads
            $(self._video).bind("canplaythrough", function() {

              if (self.options.autoplay === true) {
                self.hideWaiting();
                self.play();
                self._videoReady = true;
              }
            });

            // set the video src and begin loading
            self._video.src = vid;
          }
        };
        xhr.onreadystatechange = function(oEvent) {
          if (xhr.readyState === 4) {
            if (xhr.status !== 200) {
              console.error('Video error: status ' + xhr.status);
              self.showError();
            }
          }
        };
        xhr.send();

        if (!isIE) {
          createAnimation();
        }
      }
    },

    // creates div and buttons for onscreen video controls
    createControls: function() {

      var muteControl = this.options.muted ? 'fa-volume-off' : 'fa-volume-up';
      var playPauseControl = this.options.autoplay ? 'fa-pause' : 'fa-play';

      var controlsHTML = ' \
              <div class="controlsWrapper">\
                <div class="valiant-progress-bar">\
                    <div style="width: 0;"></div><div style="width: 100%;"></div>\
                </div>\
                <div class="controls"> \
                    <a href="#" class="playButton button fa ' + playPauseControl + '"></a> \
					<div class="audioControl">\
						<a href="#" class="muteButton button fa ' + muteControl + '"></a> \
						<div class="volumeControl">\
							<div class="volumeBar">\
								<div class="volumeProgress"></div>\
								<div class="volumeCursor"></div>\
							</div>\
						</div>\
					</div>\
					<span class="timeLabel"></span> \
                    <a href="#" class="fullscreenButton button fa fa-expand"></a> \
                </div> \
              </div>\
            ';

      $(this.element).append(controlsHTML, true);
      $(this.element).append('<div class="timeTooltip">00:00</div>', true);

      // hide controls if option is set
      if (this.options.hideControls) {
        $(this.element).find('.controls').hide();
      }

      // wire up controller events to dom elements
      this.attachControlEvents();
    },

    attachControlEvents: function() {

      // create a self var to pass to our controller functions
      var self = this;

      this.element.addEventListener('mousemove', this.onMouseMove.bind(this), false);
      this.element.addEventListener('touchmove', this.onMouseMove.bind(this), false);
      this.element.addEventListener('mousewheel', this.onMouseWheel.bind(this), false);
      this.element.addEventListener('DOMMouseScroll', this.onMouseWheel.bind(this), false);
      this.element.addEventListener('mousedown', this.onMouseDown.bind(this), false);
      this.element.addEventListener('touchstart', this.onMouseDown.bind(this), false);
      this.element.addEventListener('mouseup', this.onMouseUp.bind(this), false);
      this.element.addEventListener('touchend', this.onMouseUp.bind(this), false);

      if (this.options.keyboardControls) {
        this.element.addEventListener('keydown', this.onKeyDown.bind(this), false);
        this.element.addEventListener('keyup', this.onKeyUp.bind(this), false);
        // Used custom press event because for the arrow buttons is not throws the 'keypress' event
        this.element.addEventListener('keyArrowPress', this.onKeyArrowPress.bind(this), false);
        this.element.addEventListener('click', function() {
          $(self.element).focus();
        }, false);
      }

      $(self.element).find('.controlsWrapper > .valiant-progress-bar')[0].addEventListener("click", this.onProgressClick.bind(this), false);
      $(self.element).find('.controlsWrapper > .valiant-progress-bar')[0].addEventListener("mousemove", this.onProgressMouseMove.bind(this), false);
      $(self.element).find('.controlsWrapper > .valiant-progress-bar')[0].addEventListener("mouseout", this.onProgressMouseOut.bind(this), false);

      $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', this.fullscreen.bind(this));

      $(window).resize(function() {
        self.resizeGL($(self.element).width(), $(self.element).height());
      });

      // Player Controls
      $(this.element).find('.playButton').click(function(e) {
        e.preventDefault();
        if ($(this).hasClass('fa-pause')) {
          $(this).removeClass('fa-pause').addClass('fa-play');
          self.pause();
        } else {
          $(this).removeClass('fa-play').addClass('fa-pause');
          self.play();
        }
      });

      $(this.element).find(".fullscreenButton").click(function(e) {
        e.preventDefault();
        var elem = $(self.element)[0];
        if ($(this).hasClass('fa-expand')) {
          if (elem.requestFullscreen) {
            elem.requestFullscreen();
          } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
          } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
          } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
          }
        } else {
          if (elem.requestFullscreen) {
            document.exitFullscreen();
          } else if (elem.msRequestFullscreen) {
            document.msExitFullscreen();
          } else if (elem.mozRequestFullScreen) {
            document.mozCancelFullScreen();
          } else if (elem.webkitRequestFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      });

      $(this.element).find(".muteButton").click(function(e) {
        e.preventDefault();
        if ($(this).hasClass('fa-volume-off')) {
          $(this).removeClass('fa-volume-off').addClass('fa-volume-up');
          self._video.muted = false;
        } else {
          $(this).removeClass('fa-volume-up').addClass('fa-volume-off');
          self._video.muted = true;
        }
      });

      $(this.element).find('.controlsWrapper .volumeControl')
        .mousedown(this.onVolumeMouseDown.bind(this))
        .mouseup(this.onVolumeMouseUp.bind(this))
        .mouseleave(this.onVolumeMouseUp.bind(this))
        .mousemove(this.onVolumeMouseMove.bind(this));

      $(this._video).on('volumechange', this.onVolumeChange.bind(this));
    },

    onMouseMove: function(event) {
      this._onPointerDownPointerX = event.clientX;
      this._onPointerDownPointerY = -event.clientY;

      this.relativeX = event.pageX - $(this.element).find('canvas').offset().left;

      this._onPointerDownLon = this._lon;
      this._onPointerDownLat = this._lat;

      var x, y;

      if (this.options.clickAndDrag) {
        if (this._mouseDown) {
          x = event.pageX - this._dragStart.x;
          y = event.pageY - this._dragStart.y;
          this._dragStart.x = event.pageX;
          this._dragStart.y = event.pageY;
          this._lon += x;
          this._lat -= y;
        }
      } else {
        x = event.pageX - $(this.element).find('canvas').offset().left;
        y = event.pageY - $(this.element).find('canvas').offset().top;
        this._lon = (x / $(this.element).find('canvas').width()) * 430 - 225;
        this._lat = (y / $(this.element).find('canvas').height()) * -180 + 90;
      }
    },

    onMouseWheel: function(event) {

      var wheelSpeed = -0.01;

      // WebKit
      if (event.wheelDeltaY) {
        this._fov -= event.wheelDeltaY * wheelSpeed;
        // Opera / Explorer 9
      } else if (event.wheelDelta) {
        this._fov -= event.wheelDelta * wheelSpeed;
        // Firefox
      } else if (event.detail) {
        this._fov += event.detail * 1.0;
      }

      if (this._fov < this.options.fovMin) {
        this._fov = this.options.fovMin;
      } else if (this._fov > this.options.fovMax) {
        this._fov = this.options.fovMax;
      }
      this._camera.setLens(this._fov);
      event.preventDefault();
    },

    onMouseDown: function(event) {
      this._mouseDown = true;
      this._dragStart.x = event.pageX;
      this._dragStart.y = event.pageY;
    },

    onProgressClick: function(event) {
      if (this._isVideo && this._video.readyState === this._video.HAVE_ENOUGH_DATA) {
        var percent = this.relativeX / $(this.element).find('canvas').width() * 100;
        $(this.element).find('.controlsWrapper > .valiant-progress-bar')[0].children[0].setAttribute("style", "width:" + percent + "%;");
        $(this.element).find('.controlsWrapper > .valiant-progress-bar')[0].children[1].setAttribute("style", "width:" + (100 - percent) + "%;");
        this._video.currentTime = this._video.duration * percent / 100;
      }
    },

    onProgressMouseMove: function(event) {
      var percent = this.relativeX / $(this.element).find('canvas').width() * 100;
      if (percent) {
        var tooltip = $(this.element).find('.timeTooltip');
        var tooltipLeft = (this.relativeX - (tooltip.width() / 2));
        tooltipLeft = tooltipLeft < 0 ? 0 : Math.min(tooltipLeft, $(this.element).find('canvas').width() - tooltip.outerWidth());
        tooltip.css({
          left: tooltipLeft + 'px'
        });
        tooltip.show();
        var time = (percent / 100) * this._video.duration;
        var timeMin = Math.floor(time / 60);
        var timeSec = Math.floor(time - (timeMin * 60));
        tooltip.html(timeMin + ':' + (timeSec < 10 ? '0' + timeSec : timeSec));
      }
    },

    onProgressMouseOut: function(event) {
      $(this.element).find('.timeTooltip').hide();
    },

    onMouseUp: function(event) {
      this._mouseDown = false;
    },

    onKeyDown: function(event) {
      var keyCode = event.keyCode;
      if (keyCode >= 37 && keyCode <= 40) {
        event.preventDefault();
        this._keydown = true;
        var pressEvent = document.createEvent('CustomEvent');
        pressEvent.initCustomEvent("keyArrowPress", true, true, {
          'keyCode': keyCode
        });
        this.element.dispatchEvent(pressEvent);
      }
    },

    onKeyUp: function(event) {
      var keyCode = event.keyCode;
      if (keyCode >= 37 && keyCode <= 40) {
        event.preventDefault();
        this._keydown = false;
      }
    },

    onKeyArrowPress: function(event) {
      console.log(">>>>");
      if (this._keydown) {
        var keyCode = event.detail ? event.detail.keyCode : null;
        var offset = 3;
        var pressDelay = 50;
        var element = this.element;
        event.preventDefault();
        switch (keyCode) {
          //Arrow left
          case 37:
            offsetT_Target += 0.01;
            //this._lon -= offset;
            break;
            //Arrow right
          case 39: //this._lon += offset;
            offsetT_Target -= 0.01;
            break;
            //Arrow up
          case 38:
            this._lat += offset;
            break;
            //Arrow down
          case 40:
            this._lat -= offset;
            break;
        }
        setTimeout(function() {
            var pressEvent = document.createEvent('CustomEvent');
            pressEvent.initCustomEvent("keyArrowPress", true, true, {
              'keyCode': keyCode
            });
            element.dispatchEvent(pressEvent);
          },
          pressDelay);
      }
    },

    onVolumeMouseDown: function(event) {
      event.preventDefault();
      this._volumeMouseDown = true;
      this.onVolumeMouseMove(event);
    },

    onVolumeMouseUp: function(event) {
      event.preventDefault();
      this._volumeMouseDown = false;
    },

    onVolumeMouseMove: function(event) {
      event.preventDefault();
      if (this._volumeMouseDown) {
        var volumeControl = $(this.element).find('.controlsWrapper .volumeControl');
        var percent = (this.relativeX - volumeControl.offset().left + (volumeControl.find('.volumeBar > .volumeCursor').width() / 2)) / volumeControl.width() * 100;
        if (percent >= 0 && percent <= 100) {
          this._video.volume = percent / 100;
        }
      }
    },

    onVolumeChange: function(event) {
      //change volume cursor value
      var percent = this._video.muted == true && !this._volumeMouseDown ? 0 : (this._video.volume * 100);
      $(this.element).find('.controlsWrapper .volumeControl > .volumeBar').css({
        width: percent + "%"
      });

      //change mute button
      var muteButton = $(this.element).find(".muteButton");
      if ((percent > 0 && muteButton.hasClass('fa-volume-off')) || (percent == 0 && muteButton.hasClass('fa-volume-up'))) {
        muteButton.click();
      }
    },

    animate: function() {


      /*var data1 = context.getImageData(50, 50, 1, 1).data;
      var data2 = context.getImageData(1050, 1050, 1, 1).data;
      this.options.frameC++;
      console.log(data[0],data2);*/
      // set our animate function to fire next time a frame is ready
      this._requestAnimationId = requestAnimationFrame(this.animate.bind(this));

      if (this._isVideo) {
        if (this._video.readyState === this._video.HAVE_ENOUGH_DATA) {
          if (this._videocanvas) {
            this._videocanvas.getContext('2d').drawImage(this._video, 0, 0, this._videocanvas.width, this._videocanvas.height);
          }
          if (typeof(this._testcanvas) !== "undefined") {
            ctx = this._testcanvas.getContext('2d');
            ctx.drawImage(this._video, 0, 0, 50, 50);
            var data1 = ctx.getImageData(0, 0, 50, 50).data;
            this.options.frameUpdated = false;
            if (typeof(this._testDiffData) != "undefined") {
              for (idx = 0; idx < data1.length; idx += 3) {
                if (idx % 4 == 3) idx--;
                if (this._testDiffData[idx] != data1[idx]) {
                  this.options.frameUpdated = true;
                  break;
                }
              }
            }
            this._testDiffData = data1;

            var ct = new Date().getTime();
            //if(ct - this._time >= 30)
            {
              this._texture.needsUpdate = this.options.frameUpdated;
              this._time = ct;
            }
          }
        }
      }
      //console.log("dsfsdf")
      this.render();
    },
    Arr2Quat: function(quaArr) {

      var W = quaArr[1];
      var X = quaArr[2];
      var Y = quaArr[3];
      var Z = quaArr[4];
      sensor_quaternion = new THREE.Quaternion();
      sensor_quaternion.x = X;
      sensor_quaternion.y = Y;
      sensor_quaternion.z = Z;
      sensor_quaternion.w = W;
      return sensor_quaternion;
    },
    QuatArrSeeking: function(Arr, start_idx, time_stamp) {
      if (start_idx >= Arr.length) return 0;
      if (Arr[start_idx][0] > time_stamp) {
        return 0;
      }

      for (i = start_idx + 1; i < Arr.length; i++) {
        if (Arr[i][0] > time_stamp) {
          return i - 1;
        }
      }
      return 0;
    },
    render: function() {
      if (typeof this._video != 'undefined' && this.options.frameUpdated) {
        //this.curIdx=0;
        //console.log(">",this._video.currentTime);
        //this.options.offsetT=(this.options.offsetT-0.002)*0.8+0.002;//Try to converge to 0
        var spf = 1 / 30.0;
        if (this.options.offsetT > spf) this.options.offsetT -= spf;
        else if (this.options.offsetT < -spf) this.options.offsetT += spf;

        tmpT = this._video.currentTime + this.options.offsetT;
        var estFrameC = Math.round(tmpT / spf);

        if (this.options.frameC == estFrameC) {
          estFrameC += 0.5;
        } else {

          this.options.frameC = estFrameC;
        }
        var IMU_Data_time = estFrameC * spf;
        this.options.offsetT += 0.1 * (IMU_Data_time - tmpT);

        console.log(this._video.currentTime, "..", offsetT_Target);

        IMU_Data_time += offsetT_Target;
        //offsetT=this.options.frameC*0.033+offsetTime;

        var currentIdx = this.QuatArrSeeking(this.options.tc_globalViewQua, this.options.tc_curIdx, IMU_Data_time);
        this.options.tc_curIdx = currentIdx;
        currentIdx %= this.options.tc_globalViewQua.length;
        progress = this._video.currentTime / this._video.duration;
        /*this._lat=90*progress;
        this._lon=180*progress;*/
        if (this.options.tc_globalViewQua[0].length == 5) //Euler
        {
          this._camera.useQuaternions = false;
          this._lat = this.options.tc_globalViewQua[currentIdx][3] / 10;
          //this._lat=globalViewQua[currentIdx][2];
          this._lon = -this.options.tc_globalViewQua[currentIdx][2] / 10;
          //console.log(this._camera);
        } else {

          this._camera.useQuaternions = true;
          sensor_quaternion_init = this.Arr2Quat(this.options.tc_globalViewQua[0]);
          sensor_quaternion = this.Arr2Quat(this.options.tc_globalViewQua[currentIdx]);
          sensor_quaternion.slerp(
            this.Arr2Quat(this.options.tc_globalViewQua[currentIdx + 1]),
            (IMU_Data_time - this.options.tc_globalViewQua[currentIdx][0]) /
            (this.options.tc_globalViewQua[currentIdx + 1][0] - this.options.tc_globalViewQua[currentIdx][0]));

          quat1 = new THREE.Quaternion();
          quat2 = new THREE.Quaternion();
          var m = new THREE.Matrix4();
          m.makeRotationX(-Math.PI / 2);

          quat1.setFromRotationMatrix(m);


          /*
                        m.makeRotationZ ( -1.6);
                        quat2.setFromRotationMatrix(m);
                        quat1.multiply(quat2);
          */

          quat1.multiply(sensor_quaternion_init);

          sensor_quaternion.inverse();
          quat1.multiply(sensor_quaternion);


          m.set(0, 0, 1, 0,
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 0, 1, );
          quat2.setFromRotationMatrix(m);
          quat1.multiply(quat2);


          m.makeRotationY(-this._lon / 180 * 3.3);
          quat2.setFromRotationMatrix(m);
          quat1.multiply(quat2);
          m.makeRotationX(this._lat / 180 * 3.3);
          quat2.setFromRotationMatrix(m);
          quat1.multiply(quat2);

          this._camera.quaternion.slerp(quat1, 1);
        }
      } else {
        console.log("NO Change");
      }

      if (this._camera.useQuaternions != true) {
        this._lat = Math.max(-85, Math.min(85, this._lat));
        this._phi = (90 - this._lat) * Math.PI / 180;
        this._theta = this._lon * Math.PI / 180;
        //phi=yaw theta=pitch
        var cx = 500 * Math.sin(this._phi) * Math.cos(this._theta);
        var cy = 500 * Math.cos(this._phi);
        var cz = 500 * Math.sin(this._phi) * Math.sin(this._theta);

        this._camera.lookAt(new THREE.Vector3(cx, cy, cz));

        // distortion
        if (this.options.flatProjection) {
          this._camera.position.x = 0;
          this._camera.position.y = 0;
          this._camera.position.z = 0;
        } else {
          this._camera.position.x = -cx;
          this._camera.position.y = -cy;
          this._camera.position.z = -cz;
        }
      } else {
        var ppp = new THREE.Vector3(0, 0, 500).applyQuaternion(this._camera.quaternion)
        this._camera.position.x = ppp.x;
        this._camera.position.y = ppp.y;
        this._camera.position.z = ppp.z;
      }

      /*

                  console.log(this._camera);
      */
      //console.log(this._scene);
      this._renderer.clear();
      this._renderer.render(this._scene, this._camera);
    },

    // Video specific functions, exposed to controller
    play: function() {
      //code to play media
      this._video.play();
    },

    pause: function() {
      //code to stop media
      this._video.pause();
    },

    loadVideo: function(videoFile) {
      this._video.src = videoFile;
    },
    unloadVideo: function() {
      // overkill unloading to avoid dreaded video 'pending' bug in Chrome. See https://code.google.com/p/chromium/issues/detail?id=234779
      this.pause();
      this._video.src = '';
      this._video.removeAttribute('src');
    },
    loadPhoto: function(photoFile) {
      this._texture = THREE.ImageUtils.loadTexture(photoFile);
    },

    fullscreen: function() {
      if ($(this.element).find('a.fa-expand').length > 0) {
        this.resizeGL(screen.width, screen.height);

        $(this.element).addClass('fullscreen');
        $(this.element).find('a.fa-expand').removeClass('fa-expand').addClass('fa-compress');

        this._isFullscreen = true;
      } else {
        this.resizeGL(this._originalWidth, this._originalHeight);

        $(this.element).removeClass('fullscreen');
        $(this.element).find('a.fa-compress').removeClass('fa-compress').addClass('fa-expand');

        this._isFullscreen = false;
      }
    },

    resizeGL: function(w, h) {
      this._renderer.setSize(w, h);
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    },

    showWaiting: function() {
      var loading = $(this.element).find('.loading');
      loading.find('.waiting-icon').show();
      loading.find('.error-icon').hide();
      loading.show();
    },

    hideWaiting: function() {
      $(this.element).find('.loading').hide();
    },

    showError: function() {
      var loading = $(this.element).find('.loading');
      loading.find('.waiting-icon').hide();
      loading.find('.error-icon').show();
      loading.show();
    },

    destroy: function() {
      window.cancelAnimationFrame(this._requestAnimationId);
      this._requestAnimationId = '';
      this._texture.dispose();
      this._scene.remove(this._mesh);
      if (this._isVideo) {
        this.unloadVideo();
      }
      $(this._renderer.domElement).remove();
    }
  };

  $.fn[pluginName] = function(options) {
    // use pluginArguments instead of this.each arguments, otherwise Valiant360('loadVideo', 'path/to/video') path argument will be missing
    var pluginArguments = arguments;
    return this.each(function() {
      if (typeof options === 'object' || !options) {
        // A really lightweight plugin wrapper around the constructor,
        // preventing against multiple instantiations
        this.plugin = new Plugin(this, options);
        if (!$.data(this, "plugin_" + pluginName)) {
          $.data(this, "plugin_" + pluginName, this.plugin);
        }
      } else if (this.plugin[options]) {
        // Allows plugin methods to be called - use pluginArguments instead of this.each arguments
        return this.plugin[options].apply(this.plugin, Array.prototype.slice.call(pluginArguments, 1))
      }
    });
  };

})(jQuery, THREE, Detector, window, document);
