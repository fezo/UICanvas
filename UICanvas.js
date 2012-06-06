function roundRect(ctx, x, y, width, height, radius, fill, stroke, counter) {
    if (typeof stroke == "undefined" ) {
        stroke = true;
    }
    if (typeof radius === "undefined") {
        radius = 5;
    }
    
    if(!counter){
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    } else {
        ctx.moveTo(x + width - radius, y);
        ctx.lineTo(x + radius, y);
        ctx.quadraticCurveTo(x, y, x, y + radius);
        ctx.lineTo(x, y + height - radius);
        ctx.quadraticCurveTo(x, y + height, x + radius, y + height);
        ctx.lineTo(x + width - radius, y + height);
        ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
        ctx.lineTo(x + width, y + radius);
        ctx.quadraticCurveTo(x + width, y, x + width - radius, y);
    }
  
    if (stroke) {
        ctx.stroke();
    }
    if (fill) {
        ctx.fill();
    }        
}

function UIControl() {
    this.boundEvents = {};
    this.state = UIControl.stateNormal;
    this.propogateEvents = true;
    this.width = 0;
    this.height = 0;
    this.top = 0;
    this.position = {top: 0, left: 0};
    this.userInteractionsEnabled = true;
}

UIControl.firstResponder = null;
UIControl.stateNormal = 0;
UIControl.stateHighlighted = 1;
UIControl.stateDisabled = 2;
UIControl.stateSelected = 3;
UIControl.outEvents = {};
UIControl.inEvents = [];
UIControl.nextFrameEvents = [];

UIControl.prototype = {
    
    bind: function(type, callback, propogate, bindInEditor){        
        //fix mouse events for iOS

        if(typeof(bindInEditor) === 'undefined'){
            bindInEditor = false;
        }
        var isEditing = false;
        if(!isEditing || bindInEditor){
            this.boundEvents[type] = {propogates: propogate, type: type, callback: callback};
            document.removeEventListener(type, UIControl.receiveEvent, false); //only bind once
            document.addEventListener(type, UIControl.receiveEvent, false);
        }
    },
    setUserInteractionsEnabled: function(enabled){
        this.userInteractionsEnabled = enabled;  
    },
    unbind: function(type){
        delete this.boundEvents[type];
    },
    setWidth: function(width){
        this.width = width;
    },
    setHeight: function(height){
        this.height = height;
    },
    setPosition: function(position){
        this.position = position;
    },
    resignFirstResponder: function(){
        if(UIControl.firstResponder == this){
            UIControl.firstResponder.willResignFirstResponder();
            UIControl.firstResponder = null;
        }
    },
    canBecomeFirstResponder: function(){
      return false; //let control objects choose for themselves to accept responsibility  
    },
    getScale: function(el){
        var st = window.getComputedStyle(el, null);

        var tr = st.getPropertyValue("-webkit-transform") ||
                 st.getPropertyValue("-moz-transform") ||
                 st.getPropertyValue("-ms-transform") ||
                 st.getPropertyValue("-o-transform") ||
                 st.getPropertyValue("transform") ||
                 "Either no transform set, or browser doesn't do getComputedStyle";
        if(tr !== 'none'){
            var values = tr.split('(')[1];
                values = values.split(')')[0];
                values = values.split(',');

            var a = values[0];
            var b = values[1];
            var c = values[2];
            var d = values[3];

            return Math.sqrt(a*a + b*b);
        } else {
            return 1.0;
        }
    },
    checkForEvents: function(){
        if(!this.userInteractionsEnabled) return;
        for(var i = 0, iLen = UIControl.inEvents.length; i < iLen; i++){
            var event = UIControl.inEvents[i];
            
            if((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i)) || (navigator.userAgent.match(/iPad/i)) || (navigator.userAgent.match(/Mozilla/i))){
                var scale = this.getScale(window.document.body);
                event.offsetX = event.pageX / scale;
                event.offsetY = event.pageY / scale;
            }
            var boundEvent = this.boundEvents[event.type];
            if(!boundEvent){
                continue;
            }
            var x = event.offsetX;
            var y = event.offsetY;
           
            if (!x) {
                x = event.layerX;
                y = event.layerY;
            }
                             
            var eventPos = [x, y, 0];
            var transform = [this.position.left, this.position.top, 0];
            var size = [this.width, this.height, 0];
            if(typeof(this.ctx.matrix) !== 'undefined'){
                mat4.multiplyVec3(this.ctx.matrix, transform);
                var scaleX = vec3.length([this.ctx.matrix[0],this.ctx.matrix[1],this.ctx.matrix[2]]);
                var scaleY = vec3.length([this.ctx.matrix[4],this.ctx.matrix[5],this.ctx.matrix[6]]);
                var scaleZ = vec3.length([this.ctx.matrix[8],this.ctx.matrix[8],this.ctx.matrix[10]]);
                vec3.scale([scaleX,scaleY,scaleZ],size);
            }
            var x1 = transform[0];
            var y1 = transform[1];
            var x2 = x1 + size[0];
            var y2 = y1 + size[1];
            if( (UIControl.firstResponder == this && event.constructor == KeyboardEvent) || (eventPos[0] >= x1 && eventPos[0] <= x2 && eventPos[1] >= y1 && eventPos[1] <= y2)){
                var timestamp = event.timestamp | event.timeStamp;
                var nu = {};
                nu.constructor = event.constructor;
                for(var key in event){
                    try{
                        var value = JSON.parse(JSON.stringify(event[key]));
                        nu[key] = value;
                    } catch(err){
                        nu[key] = event[key];
                    }
                }
                nu.originatingEvent = event;
                event = nu;
                event.preventDefault = function(){
                    this.originatingEvent.preventDefault();
                }
                
                if(typeof(UIControl.outEvents[timestamp+event.type]) === 'undefined'){
                    UIControl.outEvents[timestamp+event.type] = [];
                }
                nu.surfaceX = eventPos[0]-x1; //helpers
                nu.surfaceY = eventPos[1]-y1; //helpers
                if(boundEvent.propogates){
                    UIControl.outEvents[timestamp + event.type].push({control: this, event: event});
                } else {
                    UIControl.outEvents[timestamp + event.type].length = 0; //propogateEvents off, nobody before me gets this event
                    UIControl.outEvents[timestamp + event.type].push({control: this, event: event});
                }
                if(event.originatingEvent.constructor == MouseEvent){
                    if(this.canBecomeFirstResponder()){
                        UIControl.firstResponder = this;
                    }
                }
            } else if(UIControl.firstResponder == this && event.constructor == MouseEvent) { //clicked outside of area
                this.resignFirstResponder();
            }
        }
    }
}

UIControl.receiveEvent = function(e){
    if (e.keyCode == 8 || e.keyCode == 46 || e.keyCode == 37 || e.keyCode == 39 || e.keyCode == 32) {
        e.preventDefault(); //these keys provide functionality to our uicanvas and default behavior will conflict
    }
    
    UIControl.nextFrameEvents.push(e);
};

UIControl.sendEvents = function(){
    for(var eventTimeStamp in UIControl.outEvents){
        var chain = UIControl.outEvents[eventTimeStamp];
        for(var i = 0, iLen = chain.length; i < iLen; i++){
            var control = chain[i].control;
            var event = chain[i].event;
            var bound = control.boundEvents[event.type];
            if(bound){
                bound.callback.call(control, event);
            }
        }
    }
    UIControl.outEvents = {};
    UIControl.inEvents = UIControl.nextFrameEvents;
    UIControl.nextFrameEvents = [];
};

// Start Slider

UISlider.prototype = new UIControl();
UISlider.prototype.constructor = UISlider;

function UISlider(ctx){
    this.ctx = ctx;
    this.color = 'rgba(255,255,255,1.0)';
    this.width = 118;
    this.height = 23;
    this.fontSize = '12pt';
    this.style =  'normal';
    this.font =  'Helvetica';
    this.userInteractionsEnabled = false;
    this.continuous = false;
    
    this.value = 0.0;
    this.maximumValue = 1.0;
    this.minimumTrackTintColor = {r: 0, g: 127, b: 234, a: 1.0};
    this.maximumTrackTintColor = {r: 238, g: 238, b: 238, a: 1.0};
    
    this.thumbX = (this.width/2)-this.height/2;
    
    this.updateGradient();
    
    var that = this;
    var mouseIsDown = false;
    var lastX = 0;
    var downStart = {x: 0, y: 0};
    this.mouseDownThumbX = this.thumbX;
    this.mouseUpThumbX = this.thumbX;
    var didChange = false;
    this.bind('mousedown', function(e){
        that.mouseDownThumbX = that.thumbX;
        that.isMoving = true;
        mouseIsDown = true;
        lastX = e.surfaceX;
        downStart.x = e.surfaceX;
        downStart.y = e.surfaceY;
        this.lastValue = this.value;
        didChange = false;
    }, true);
    
    this.bind('mousemove', function(e){
        if(mouseIsDown){
            var movementDelta = e.surfaceX - lastX;
            that.thumbX += movementDelta;
            
            var thumbLeft = that.height/2;
            var thumbRight = that.width-that.height/2;
            if (that.thumbX < thumbLeft) {
                that.thumbX = thumbLeft;
            } else if (that.thumbX > thumbRight) {
                that.thumbX = thumbRight;
            }
            
            var trackLength = thumbRight - thumbLeft;
            var val = (that.thumbX - thumbLeft) /  trackLength;
            that.value = val * that.maximumValue;
            
            that.updateGradient();
            
            lastX = e.surfaceX;
            
            if(this.value != this.lastValue && this.valueChangeCallback){
                this.lastValue = this.value;
                this.valueChangeCallback(this.value, this.continuous);
                didChange = true;
            }
        }
    }, true);
    
    this.bind('mouseup', function(e){
        that.isMoving = false;
        mouseIsDown = false;
        that.mouseUpStart = (new Date()).getTime();
        that.mouseUpThumbX = that.thumbX;
        if(didChange && !this.continuous){
            this.valueChangeCallback(this.value, true);
        }
    }, true);
}

UISlider.prototype.updateGradient = function(){
    var thumbLeft = this.height/2;
    var thumbRight = this.width-this.height/2;
    if (this.thumbX < thumbLeft) {
        this.thumbX = thumbLeft;
    } else if (this.thumbX > thumbRight) {
        this.thumbX = thumbRight;
    }
    
    this.gradient = this.ctx.createLinearGradient(0,0,this.width,0);
    this.gradient.addColorStop(0.0, 'rgba(' + this.minimumTrackTintColor.r + ',' + this.minimumTrackTintColor.g + ',' + this.minimumTrackTintColor.b + ',' + this.minimumTrackTintColor.a + ')');
    this.gradient.addColorStop(this.thumbX / this.width, 'rgba(' + this.minimumTrackTintColor.r + ',' + this.minimumTrackTintColor.g + ',' + this.minimumTrackTintColor.b + ',' + this.minimumTrackTintColor.a + ')');
    this.gradient.addColorStop(this.thumbX / this.width, 'rgba(' + this.maximumTrackTintColor.r + ',' + this.maximumTrackTintColor.g + ',' + this.maximumTrackTintColor.b + ',' + this.maximumTrackTintColor.a + ')');
    this.gradient.addColorStop(1.0, 'rgba(' + this.maximumTrackTintColor.r + ',' + this.maximumTrackTintColor.g + ',' + this.maximumTrackTintColor.b + ',' + this.maximumTrackTintColor.a + ')');
}

UISlider.prototype.draw = function() {
    var thumbLeft = this.height/2;
    var thumbRight = this.width-this.height/2;

    if(this.animate){
        var delta = (new Date()).getTime() - this.animateStart;
        var change = this.animateThumbEnd - this.animateThumbStart;
        this.thumbX = this.animateThumbStart + Math.easeOutQuart(delta, 0, change, 500);
        this.updateGradient();
        if(delta > 500){
            this.animate = false;
            this.thumbX = this.animateThumbEnd;
        }
    }
    
    var trackToThumbRatio = 0.4;

    var trackYAdj = this.height/2-(this.height*trackToThumbRatio)/2;
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#000';
    this.ctx.fillStyle = this.gradient;
    roundRect(this.ctx, this.position.left, this.position.top+trackYAdj, this.width, this.height*trackToThumbRatio, this.height*0.5*trackToThumbRatio, false, false, true);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.closePath();
    
    this.ctx.save();
    
    this.ctx.beginPath(); 
    this.ctx.shadowColor = "rgba(255,255,255,1.0)";
    this.ctx.shadowBlur = 2
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
          
    this.ctx.globalCompositeOperation = 'source-atop';
    this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(this.ctx, this.position.left, this.position.top+(this.height*trackToThumbRatio*0.47)+trackYAdj, this.width, this.height*0.5*trackToThumbRatio, this.height*0.3*trackToThumbRatio, false, false, false);
    this.ctx.fill();
    this.ctx.closePath();
    
    this.ctx.restore();
    
    this.ctx.save();
    roundRect(this.ctx, this.position.left, this.position.top+trackYAdj, this.width, this.height*trackToThumbRatio, this.height*0.5*trackToThumbRatio, false, false, true);
    this.ctx.clip();
    
    this.ctx.beginPath();
    var adj = document.body.offsetWidth;
    this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    this.ctx.shadowColor = "rgba(0,0,0,1)";
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetX = -adj;
    this.ctx.shadowOffsetY = 1;
    roundRect(this.ctx, this.position.left+adj, this.position.top+trackYAdj, this.width, this.height*trackToThumbRatio, this.height*0.5*trackToThumbRatio, false, false, true);
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.closePath();
    
    this.ctx.shadowColor = "rgba(0,0,0,0.2)";
    this.ctx.shadowBlur = 2;
    this.ctx.shadowOffsetY = 1;
    roundRect(this.ctx, this.position.left+adj, this.position.top+trackYAdj, this.width, this.height*trackToThumbRatio, this.height*0.5*trackToThumbRatio, false, false, true);
    this.ctx.stroke();
    this.ctx.stroke();
    
    this.ctx.shadowColor = "rgba(0,0,0,0.3)";
    this.ctx.shadowBlur = 3;
    this.ctx.shadowOffsetY = -1;
    roundRect(this.ctx, this.position.left+adj, this.position.top+trackYAdj, this.width, this.height*trackToThumbRatio, this.height*0.5*trackToThumbRatio, false, false, true);
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.stroke();
    
    this.ctx.shadowColor = "rgba(255,255,255,0.5)";
    this.ctx.shadowBlur = 3;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    

    this.ctx.restore();
    
    this.thumbGradient = this.ctx.createRadialGradient(this.thumbX, this.height/2, 0.00, this.thumbX, this.height/2, this.height/2);
    this.thumbGradient.addColorStop(0.0, 'rgba(250,250,250,0.91)');
    this.thumbGradient.addColorStop(0.04, 'rgba(254,254,254,1)');
    this.thumbGradient.addColorStop(0.87, 'rgba(210,210,210,1)');
    this.thumbGradient.addColorStop(0.92, 'rgba(212,212,212,1)');
    this.thumbGradient.addColorStop(0.96, 'rgba(230,230,230,1)');
    this.thumbGradient.addColorStop(1.00, 'rgba(238,238,238,0.91)');
    
    this.ctx.beginPath();
    this.ctx.fillStyle = this.thumbGradient;
    this.ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    var h = this.height * 0.98;
    this.ctx.arc(this.thumbX,this.height/2,h/2, 0, Math.PI+(Math.PI*4)/2, false);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.closePath();
    
    this.checkForEvents();
}
  
UISlider.prototype.valueChange = function(callback) {
    this.valueChangeCallback = callback;
}


UISlider.prototype.setValue = function(value, animated) {
    value = parseInt(value);
    if(this.value != value){
        this.value = Math.max(0, Math.min(value, this.maximumValue));
        var thumbLeft = this.height/2;
        var thumbRight = this.width-this.height/2;
        var trackLength = thumbRight - thumbLeft;
        var newThumbX = thumbLeft + trackLength * (this.value / this.maximumValue);
        
        if(animated){
            this.animate = true;
            this.animateThumbStart = this.thumbX;
            this.animateThumbEnd = newThumbX;
            this.animateStart = (new Date()).getTime();
        } else {
            this.animate = false;       
            this.thumbX = newThumbX;
        }
    }
}


UISlider.prototype.setContinuous = function(continuous) {
  this.continuous = continuous;
}

UISlider.prototype.setMaximumValue = function(maximumValue) {
  this.maximumValue = maximumValue;
}
  
UISlider.prototype.setMinimumTrackTintColor = function(tintColor) {
    this.minimumTrackTintColor = tintColor;
    this.updateGradient();
}

UISlider.prototype.setMaximumTrackTintColor = function(tintColor) {
    this.maximumTrackTintColor = tintColor;
    this.updateGradient();
}

// Start Switch

UISwitch.prototype = new UIControl();
UISwitch.prototype.constructor = UISwitch;

function UISwitch(ctx){
    this.ctx = ctx;
    this.color = 'rgba(255,255,255,1.0)';
    this.width = 79;
    this.height = 27;
    this.fontSize = '12pt';
    this.style =  'normal';
    this.font =  'Helvetica';
    this.on = true;
    this.onTintColor = {r: 0, g: 127, b: 234, a: 1.0};
    
    this.thumbX = this.width-this.height/2;
    
    this.updateGradient();
    
    var that = this;
    var mouseIsDown = false;
    var lastX = 0;
    var downStart = {x: 0, y: 0};
    this.mouseDownThumbX = this.thumbX;
    this.mouseUpThumbX = this.thumbX;
    
    this.bind('mousedown', function(e){
        that.mouseDownThumbX = that.thumbX;
        that.isMoving = true;
        mouseIsDown = true;
        lastX = e.surfaceX;
        downStart.x = e.surfaceX;
        downStart.y = e.surfaceY;
    }, true);
    
    this.bind('mousemove', function(e){
        if(mouseIsDown){
            var movementDelta = e.surfaceX - lastX;
            that.thumbX += movementDelta;
            
            var thumbLeft = that.height/2;
            var thumbRight = that.width-that.height/2;
            if (that.thumbX < thumbLeft) {
                that.thumbX = thumbLeft;
                that.setOn(false);
            } else if (that.thumbX > thumbRight) {
                that.thumbX = thumbRight;
                that.setOn(true);
            }
            
            that.updateGradient();
            
            lastX = e.surfaceX;
        }
    }, true);
    
    this.bind('mouseup', function(e){
        that.isMoving = false;
        mouseIsDown = false;
        that.mouseUpStart = (new Date()).getTime();
        that.mouseUpThumbX = that.thumbX;
        
        
        if ( Math.abs(Math.sqrt(Math.pow(downStart.x - e.surfaceX, 2) + Math.pow(downStart.y - e.surfaceY, 2))) < 2){
            that.setOn(!that.on, true);
        }
    }, true);
}

UISwitch.prototype.updateGradient = function(){
    var thumbLeft = this.height/2;
    var thumbRight = this.width-this.height/2;
    if (this.thumbX < thumbLeft) {
        this.thumbX = thumbLeft;
    } else if (this.thumbX > thumbRight) {
        this.thumbX = thumbRight;
    }
    
    this.gradient = this.ctx.createLinearGradient(0,0,this.width,0);
    this.gradient.addColorStop(0.0, 'rgba(' + this.onTintColor.r + ',' + this.onTintColor.g + ',' + this.onTintColor.b + ',' + this.onTintColor.a + ')');
    this.gradient.addColorStop(this.thumbX / this.width, 'rgba(' + this.onTintColor.r + ',' + this.onTintColor.g + ',' + this.onTintColor.b + ',' + this.onTintColor.a + ')');
    this.gradient.addColorStop(this.thumbX / this.width, '#eeeeee');
    this.gradient.addColorStop(1.0, '#eeeeee');
}

UISwitch.prototype.draw = function() {
    var thumbLeft = this.height/2;
    var thumbRight = this.width-this.height/2;
    
    if (!this.isMoving && this.thumbX > thumbLeft && this.thumbX < thumbRight || (this.animateOn || this.animateOff)){
        if(this.mouseDownThumbX - this.mouseUpThumbX < 0 || this.animateOn){
            this.setOn(true);
            var delta = (new Date()).getTime() - this.mouseUpStart;
            this.thumbX = this.mouseUpThumbX + Math.easeOutQuart(delta, 0, thumbRight - this.mouseUpThumbX, 500);
            this.updateGradient();
            if(delta >= 500){
                this.thumbX = thumbRight;
                this.animateOn = false;
            }
        } else {
            this.setOn(false);
            var delta = (new Date()).getTime() - this.mouseUpStart;
            this.thumbX = this.mouseUpThumbX - Math.easeOutQuart(delta, 0,  this.mouseUpThumbX - thumbLeft, 500);
            this.updateGradient();
            if(delta >= 500){
                this.thumbX = thumbLeft;
                this.animateOff = false;
            }
        }
    } else if (this.thumbX < thumbLeft) {
        this.thumbX = thumbLeft;
        this.setOn(false);
    } else if (this.thumbX > thumbRight) {
        this.thumbX = thumbRight;
        this.setOn(true);
    }
    
    this.ctx.beginPath();
    this.ctx.fillStyle = this.gradient;
    roundRect(this.ctx, this.position.left, this.position.top, this.width, this.height, this.height*0.5, false, false, true);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.closePath();
    
    this.ctx.save();
    
     this.ctx.beginPath(); 
    this.ctx.shadowColor = "rgba(255,255,255,1.0)";
    this.ctx.shadowBlur = 4
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

          
    this.ctx.globalCompositeOperation = 'source-atop';
    this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(this.ctx, this.position.left + this.width*0.08, this.position.top+this.height*0.47, this.width*0.84, this.height*0.5, this.height*0.3, false, false, false);
    this.ctx.fill();
    this.ctx.closePath();
    
    this.ctx.restore();
    
    this.ctx.save();
    roundRect(this.ctx, this.position.left, this.position.top, this.width, this.height, this.height*0.5, false, false, true);
    this.ctx.clip();
    
    this.ctx.beginPath();
    var adj = document.body.offsetWidth;
    this.ctx.shadowColor = "rgba(0,0,0,1)";
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetX = -adj;
    this.ctx.shadowOffsetY = 1;
    roundRect(this.ctx, this.position.left+adj, this.position.top, this.width, this.height, this.height*0.5, false, false, true);
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.closePath();
    
    this.ctx.shadowColor = "rgba(0,0,0,0.2)";
    this.ctx.shadowBlur = 2;
    this.ctx.shadowOffsetY = 1;
    roundRect(this.ctx, this.position.left+adj, this.position.top, this.width, this.height, this.height*0.5, false, false, true);
    this.ctx.stroke();
    this.ctx.stroke();
    
    this.ctx.shadowColor = "rgba(0,0,0,0.3)";
    this.ctx.shadowBlur = 3;
    this.ctx.shadowOffsetY = -1;
    roundRect(this.ctx, this.position.left+adj, this.position.top, this.width, this.height, this.height*0.5, false, false, true);
    this.ctx.stroke();
    this.ctx.stroke();
    this.ctx.stroke();
    
    this.ctx.shadowColor = "rgba(255,255,255,0.5)";
    this.ctx.shadowBlur = 3;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    
    this.ctx.beginPath();
    this.ctx.fillStyle = 'rgba(' + this.onTintColor.r + ',' + this.onTintColor.g + ',' + this.onTintColor.b + ',' + this.onTintColor.a + ')';
    roundRect(this.ctx, this.position.left, this.position.top, this.width, this.height, this.height*0.5, false, false, true);
    this.ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.restore();
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.shadowColor = "rgba(0,0,0,0.5)";
    this.ctx.shadowOffsetX = -1;
    this.ctx.shadowOffsetY = -1;
    this.ctx.fillStyle = this.color;
    this.ctx.font = this.style + " " + parseInt(this.fontSize) + "pt " + this.font;
    
    this.ctx.rect(this.position.left, this.position.top, this.thumbX, this.height);
    this.ctx.clip();
    this.ctx.fillText("ON", this.position.left+22, this.position.top+parseInt(this.fontSize)+7, this.width); 
    this.ctx.closePath();
    this.ctx.restore();
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.fillStyle = '#949494';
    this.ctx.font = this.style + " " + parseInt(this.fontSize) + "pt " + this.font;
    
    this.ctx.rect(this.thumbX, this.position.top, this.width, this.height);
    this.ctx.clip();
    this.ctx.fillText("OFF", this.position.left+33, this.position.top+parseInt(this.fontSize)+7, this.width);
    this.ctx.closePath();
    this.ctx.restore();
    
    this.thumbGradient = this.ctx.createRadialGradient(this.thumbX, this.height/2, 0.00, this.thumbX, this.height/2, this.height/2);
    this.thumbGradient.addColorStop(0.0, 'rgba(250,250,250,0.91)');
    this.thumbGradient.addColorStop(0.04, 'rgba(254,254,254,1)');
    this.thumbGradient.addColorStop(0.87, 'rgba(210,210,210,1)');
    this.thumbGradient.addColorStop(0.92, 'rgba(212,212,212,1)');
    this.thumbGradient.addColorStop(0.96, 'rgba(230,230,230,1)');
    this.thumbGradient.addColorStop(1.00, 'rgba(238,238,238,0.91)');
    
    this.ctx.beginPath();
    this.ctx.fillStyle = this.thumbGradient;
    this.ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    var h = this.height * 0.98;
    this.ctx.arc(this.thumbX,this.height/2,h/2, 0, Math.PI+(Math.PI*4)/2, false);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.closePath();
    
    this.checkForEvents();
}


UISwitch.prototype.valueChange = function(callback) {
    this.valueChangeCallback = callback;
}

UISwitch.prototype.setOn = function(on, animated) {
    if(this.on != on){
        if(this.valueChangeCallback){
            this.valueChangeCallback(on);
        }
        this.on = on;
        if(animated){
            this.mouseUpStart = (new Date()).getTime();
            this.mouseDownThumbX = this.thumbX;
            this.mouseUpThumbX = this.thumbX;
            if(on){
                this.animateOn = true;
            } else {
                this.animateOff = true;
            }
        } else {
            var thumbLeft = this.height/2;
            var thumbRight = this.width-this.height/2;
            if(on){
                this.thumbX = thumbRight;
            } else {
                this.thumbX = thumbLeft;
            }
        }
    }
}

UISwitch.prototype.setOnTintColor = function(onTintColor) {
    this.onTintColor = onTintColor;
    this.updateGradient();
}

// Start Picker

UIPickerView.prototype = new UIControl();
UIPickerView.prototype.constructor = UIPickerView;

function UIPickerView(ctx){
    this.ctx = ctx;

    this.color = 'rgba(0,0,0,1)';
    this.width = 320;
    this.height = 216;
    this.componentWidth = 320;
    this.backgroundColor = ctx.createLinearGradient(0,0,0,this.height);
    this.backgroundColor.addColorStop(0.00, '#313945');
    this.backgroundColor.addColorStop(0.00462962962963, '#d9d9dc');
    this.backgroundColor.addColorStop(0.00925925925926, '#a2a2aa');
    this.backgroundColor.addColorStop(0.03, '#a2a2aa');
    this.backgroundColor.addColorStop(0.05, '#9d9fa5');
    this.backgroundColor.addColorStop(0.08, '#92939a');
    this.backgroundColor.addColorStop(0.11, '#84858d');
    this.backgroundColor.addColorStop(0.13, '#7d7f87');
    this.backgroundColor.addColorStop(0.16, '#7b7d85');
    this.backgroundColor.addColorStop(0.17, '#787983');
    this.backgroundColor.addColorStop(0.23, '#767781');
    this.backgroundColor.addColorStop(0.30, '#6d6d78');
    this.backgroundColor.addColorStop(0.38, '#5e606a');
    this.backgroundColor.addColorStop(0.39, '#5a5b66');
    this.backgroundColor.addColorStop(0.49, '#494b56');
    this.backgroundColor.addColorStop(0.50, '#474954');
    this.backgroundColor.addColorStop(0.50, '#272836');
    this.backgroundColor.addColorStop(1.00, '#282a39');
    
    this.innerBackgroundColor = ctx.createLinearGradient(10,10,10,this.height-10);
    this.innerBackgroundColor.addColorStop(0.0, '#313237');
    this.innerBackgroundColor.addColorStop(0.01, '#3f3f44');
    this.innerBackgroundColor.addColorStop(0.05, '#74747d');
    this.innerBackgroundColor.addColorStop(0.06, '#85868e');
    this.innerBackgroundColor.addColorStop(0.06, '#898b93');
    this.innerBackgroundColor.addColorStop(0.07, '#93939c');
    this.innerBackgroundColor.addColorStop(0.07, '#9798a1');
    this.innerBackgroundColor.addColorStop(0.09, '#abacb5');
    this.innerBackgroundColor.addColorStop(0.10, '#b6b6be');
    this.innerBackgroundColor.addColorStop(0.10, '#b8b9c1');
    this.innerBackgroundColor.addColorStop(0.11, '#bfc0c7');
    this.innerBackgroundColor.addColorStop(0.14, '#d8d9de');
    this.innerBackgroundColor.addColorStop(0.18, '#eaebee');
    this.innerBackgroundColor.addColorStop(0.23, '#f7f8f9');
    this.innerBackgroundColor.addColorStop(0.37, '#fcfcfd');
    this.innerBackgroundColor.addColorStop(0.38, '#ffffff');
    this.innerBackgroundColor.addColorStop(0.62, '#ffffff');
    this.innerBackgroundColor.addColorStop(0.63, '#fcfcfd');
    this.innerBackgroundColor.addColorStop(0.76, '#f8f9f9');
    this.innerBackgroundColor.addColorStop(0.78, '#f5f6f7');
    this.innerBackgroundColor.addColorStop(0.82, '#eaebee');
    this.innerBackgroundColor.addColorStop(0.86, '#d8d9de');
    this.innerBackgroundColor.addColorStop(0.89, '#bfc0c7');
    this.innerBackgroundColor.addColorStop(0.90, '#b8b9c1');
    this.innerBackgroundColor.addColorStop(0.90, '#b6b6be');
    this.innerBackgroundColor.addColorStop(0.91, '#abacb5');
    this.innerBackgroundColor.addColorStop(0.93, '#9798a1');
    this.innerBackgroundColor.addColorStop(0.93, '#93939c');
    this.innerBackgroundColor.addColorStop(0.94, '#898b93');
    this.innerBackgroundColor.addColorStop(0.94, '#85868e');
    this.innerBackgroundColor.addColorStop(0.95, '#74747d');
    this.innerBackgroundColor.addColorStop(0.99, '#3f3f44');
    this.innerBackgroundColor.addColorStop(1.00, '#313237');
    
    this.selectedRowBackgroundColor = ctx.createLinearGradient(10,76,10,76+49);
    this.selectedRowBackgroundColor.addColorStop(0.00, 'rgba(122, 134, 151, 1.0)');
    this.selectedRowBackgroundColor.addColorStop(0.02, 'rgba(122, 134, 151, 1.0)');
    this.selectedRowBackgroundColor.addColorStop(0.02, 'rgba(227, 228, 237, 1.0)');
    this.selectedRowBackgroundColor.addColorStop(0.04, 'rgba(212, 214, 229, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.06, 'rgba(212, 213, 228, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.15, 'rgba(200, 203, 222, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.31, 'rgba(166, 171, 202, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.44, 'rgba(151, 157, 194, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.46, 'rgba(114, 122, 173, 0.69)'); //blue start
    this.selectedRowBackgroundColor.addColorStop(0.52, 'rgba(113, 119, 171, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.88, 'rgba(110, 115, 172, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.90, 'rgba(95, 110, 130, 0.69)');
    this.selectedRowBackgroundColor.addColorStop(0.90, 'rgba(122, 134, 151, 1.0)');
    this.selectedRowBackgroundColor.addColorStop(0.92, 'rgba(122, 134, 151, 1.0)');
    this.selectedRowBackgroundColor.addColorStop(0.92, 'rgba(0, 0, 0, 0.3)');
    this.selectedRowBackgroundColor.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');
    
    this.seperatorBackgroundColor = ctx.createLinearGradient(10,10,10,this.height-10);
    this.seperatorBackgroundColor.addColorStop(0.0, '#292a35'),
    this.seperatorBackgroundColor.addColorStop(0.02, '#353541'),
    this.seperatorBackgroundColor.addColorStop(0.06, '#595a6b'),
    this.seperatorBackgroundColor.addColorStop(0.11, '#7d7f91'),
    this.seperatorBackgroundColor.addColorStop(0.14, '#9293a5'),
    this.seperatorBackgroundColor.addColorStop(0.21, '#aeafbf'),
    this.seperatorBackgroundColor.addColorStop(0.22, '#afb1c2'),
    this.seperatorBackgroundColor.addColorStop(0.25, '#bbbccb'),
    this.seperatorBackgroundColor.addColorStop(0.31, '#c9cad8'),
    this.seperatorBackgroundColor.addColorStop(0.37, '#cfd1e0'),
    this.seperatorBackgroundColor.addColorStop(0.49, '#d5d6e4'),
    this.seperatorBackgroundColor.addColorStop(0.61, '#d1d3e1'),
    this.seperatorBackgroundColor.addColorStop(0.68, '#cbccdb'),
    this.seperatorBackgroundColor.addColorStop(0.70, '#c7c8d7'),
    this.seperatorBackgroundColor.addColorStop(0.75, '#babbca'),
    this.seperatorBackgroundColor.addColorStop(0.80, '#aaabbc'),
    this.seperatorBackgroundColor.addColorStop(0.86, '#9294a6'),
    this.seperatorBackgroundColor.addColorStop(0.89, '#818395'),
    this.seperatorBackgroundColor.addColorStop(0.91, '#727486'),
    this.seperatorBackgroundColor.addColorStop(0.91, '#717284'),
    this.seperatorBackgroundColor.addColorStop(0.95, '#555566'),
    this.seperatorBackgroundColor.addColorStop(0.98, '#353541'),
    this.seperatorBackgroundColor.addColorStop(1.00, '#292a35');
    
    this.titleForRowCallback = function(component,row,callback){callback('')};
    this.numberOfComponentsCallback = function(callback){callback(0)};
    this.numberOfRowsInComponentCallback = function(component, callback){callback(0)};
    this.didSelectRowInComponentCallback = function(component,row){};
    this.rowSizeForComponentCallback = function(component){};
    
    this.rowHeight = 44;
    this.fontSize = '16pt';
    this.style =  'bold';
    this.font =  'Helvetica';
    var that = this;
    this.scrollOffset = 0;
    this.components = [];
    this.componentScrollOffsets = [];
        
    var mouseDown = false;
            
    this.bind('mousedown', function(e){
        var lastX = 0;
        var componentIdx = 0;
        for(var csoIdx in that.componentScrollOffsets){
            var width = that.componentScrollOffsets[csoIdx].width;
            if(e.surfaceX > lastX && e.surfaceX < lastX + width){
                componentIdx = csoIdx;
                break;
            } else {
                lastX += width;
            }
        }
        var date = new Date();
        mouseDown = true;
        var y = e.surfaceY;
        that.componentScrollOffsets[componentIdx].mouseDownY = y;
        that.componentScrollOffsets[componentIdx].mouseDownOffset = that.componentScrollOffsets[componentIdx].offset;
        that.componentScrollOffsets[componentIdx].adjusting = false;
    });
    
    this.bind('mousemove', function(e){
        
        if(mouseDown){   
            var date = new Date();
            var lastX = 0;
            var componentIdx = 0;
            for(var csoIdx in that.componentScrollOffsets){
                var width = that.componentScrollOffsets[csoIdx].width;
                if(e.surfaceX > lastX && e.surfaceX < lastX + width){
                    componentIdx = csoIdx;
                    break;
                } else {
                    lastX += width;
                }
            }
            
            for(var i in that.componentScrollOffsets){
                if(i != componentIdx){
                    if(that.componentScrollOffsets[i].isMoving){
                        that.componentScrollOffsets[i].isMoving = false;
                        that.componentScrollOffsets[i].mouseUpTime = date.getTime();
                        that.componentScrollOffsets[i].adjustStart = that.componentScrollOffsets[i].offset;
                        that.componentScrollOffsets[i].adjusting = true;
                    }
                }
            }
            
            if(!that.componentScrollOffsets[componentIdx].isMoving){
                that.componentScrollOffsets[componentIdx].isMoving = true;
                that.componentScrollOffsets[componentIdx].mouseDownY = e.surfaceY;
            }
            
            var y = e.surfaceY;
            var delta =  that.componentScrollOffsets[componentIdx].mouseDownY - y;
            that.componentScrollOffsets[componentIdx].offset = that.componentScrollOffsets[componentIdx].mouseDownOffset + delta;
        }
    });
    
    this.bind('mouseup', function(e){
        mouseDown = false;
        var date = new Date();
        var lastX = 0;
        var componentIdx = 0;
        for(var csoIdx in that.componentScrollOffsets){
            var width = that.componentScrollOffsets[csoIdx].width;
            if(e.surfaceX > lastX && e.surfaceX < lastX + width){
                componentIdx = csoIdx;
                break;
            } else {
                lastX += width;
            }
        }
        that.componentScrollOffsets[componentIdx].isMoving = false;
        that.componentScrollOffsets[componentIdx].mouseUpTime = date.getTime();
        that.componentScrollOffsets[componentIdx].adjustStart = that.componentScrollOffsets[componentIdx].offset;
        that.componentScrollOffsets[componentIdx].adjusting = true;
    });
}

UIPickerView.prototype.draw = function() {
    this.ctx.save();

    var date = new Date();

    for(var componentIdx in this.components){
        if (this.componentScrollOffsets[componentIdx].adjusting && this.componentScrollOffsets[componentIdx].offset < 0) {
            var delta = date.getTime() - this.componentScrollOffsets[componentIdx].mouseUpTime;
            this.componentScrollOffsets[componentIdx].offset = this.componentScrollOffsets[componentIdx].adjustStart + Math.easeOutQuart(delta, 0, Math.abs(this.componentScrollOffsets[componentIdx].adjustStart), 500);
            if(delta >= 500){
                this.componentScrollOffsets[componentIdx].adjusting = false;
                this.componentScrollOffsets[componentIdx].offset = 0;
            }
        } else if (this.componentScrollOffsets[componentIdx].adjusting && this.componentScrollOffsets[componentIdx].offset > (this.components[componentIdx].length-1) * this.rowHeight) {
            var delta = date.getTime() - this.componentScrollOffsets[componentIdx].mouseUpTime;
            this.componentScrollOffsets[componentIdx].offset = this.componentScrollOffsets[componentIdx].adjustStart - Math.easeOutQuart(delta, 0, this.componentScrollOffsets[componentIdx].adjustStart - (this.components[componentIdx].length-1) * this.rowHeight, 500);
            if(delta >= 500){
                this.componentScrollOffsets[componentIdx].adjusting = false;
                this.componentScrollOffsets[componentIdx].offset = (this.components[componentIdx].length-1) * this.rowHeight;
            }
        } else if(this.componentScrollOffsets[componentIdx].adjusting){
            var componentRows = this.components[componentIdx];
            var scrollOffset = this.componentScrollOffsets[componentIdx].offset;

            if(this.componentScrollOffsets[componentIdx].adjustStart % this.rowHeight > this.rowHeight/2){
                var delta = date.getTime() - this.componentScrollOffsets[componentIdx].mouseUpTime;
                var adj = this.rowHeight - this.componentScrollOffsets[componentIdx].adjustStart % this.rowHeight;
                this.componentScrollOffsets[componentIdx].offset = this.componentScrollOffsets[componentIdx].adjustStart + Math.easeOutQuart(delta, 0, adj, 500);
                if(delta >= 500){
                    this.componentScrollOffsets[componentIdx].adjusting = false;
                    this.componentScrollOffsets[componentIdx].offset = this.componentScrollOffsets[componentIdx].adjustStart + adj;
                }
            } else {
                var delta = date.getTime() - this.componentScrollOffsets[componentIdx].mouseUpTime;
                var adj = this.componentScrollOffsets[componentIdx].adjustStart % this.rowHeight;
                this.componentScrollOffsets[componentIdx].offset = this.componentScrollOffsets[componentIdx].adjustStart - Math.easeOutQuart(delta, 0, adj, 500);
                
                if(delta >= 500){
                    this.componentScrollOffsets[componentIdx].adjusting = false;
                    this.componentScrollOffsets[componentIdx].offset = this.componentScrollOffsets[componentIdx].adjustStart - adj;
                }
            }
        }
    }
    
    
    this.ctx.beginPath();
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.rect(this.position.left, this.position.top,  this.width, this.height);
    this.ctx.fill();
    this.ctx.closePath();
    
    this.ctx.fillStyle = this.innerBackgroundColor;
    roundRect(this.ctx, this.position.left+10, this.position.top+10, this.width-20, this.height-20, 3, true, false);
    
    this.ctx.rect(this.position.left+10, this.position.top+10, this.width-20, this.height-20);
    this.ctx.clip();
    
    if(this.components.length == 0 || this.reloading) return;
    
    this.ctx.font = this.style + " " + parseInt(this.fontSize) + "pt " + this.font;
    var visibleRows = Math.ceil(this.height / this.rowHeight)+2;
    
    var lastX = 0;
    for(var componentIdx in this.components){
        var componentRows = this.components[componentIdx];
        var scrollOffset = this.componentScrollOffsets[componentIdx].offset;
        
        var rowsOffset = scrollOffset / this.rowHeight;
        var visibleRangeTop = 0;
        if (rowsOffset > 0) {
            visibleRangeTop = Math.floor(rowsOffset);
        } else if (rowsOffset < 0) {
            visibleRangeTop = Math.ceil(rowsOffset);
        }
        visibleRangeTop = visibleRangeTop - 2;
        
        if(this.didSelectRowInComponentCallback){
            if(!(this.componentScrollOffsets[componentIdx].isMoving || this.componentScrollOffsets[componentIdx].adjusting) && this.componentScrollOffsets[componentIdx].lastSelectedIdx !=  visibleRangeTop + 2){
                this.componentScrollOffsets[componentIdx].lastSelectedIdx =  visibleRangeTop + 2;
                this.didSelectRowInComponentCallback(componentIdx, this.componentScrollOffsets[componentIdx].lastSelectedIdx);
            }
        }
        
        if(componentIdx != this.components.length-1){
            this.ctx.beginPath();
            this.ctx.fillStyle = this.seperatorBackgroundColor;
            this.ctx.rect(lastX+this.componentScrollOffsets[componentIdx].width, this.position.top,  8, this.height-10);
            this.ctx.fill();
            this.ctx.closePath();
            
            this.ctx.beginPath();
            this.ctx.fillStyle = '#000';
            this.ctx.rect(lastX+this.componentScrollOffsets[componentIdx].width+3, this.position.top,  2, this.height-10);
            this.ctx.fill();
            this.ctx.closePath();
        }
        
        
        var visibleRangeBottom = visibleRangeTop + visibleRows;
        var cellOffset = scrollOffset % this.rowHeight;
        
        var x = 0;
        this.ctx.beginPath();
        for(var i = visibleRangeTop; i < visibleRangeBottom; i++){
                    
            var iVisible = x;
            var x1 = this.position.left + lastX;
            var x2 = x1 + this.componentScrollOffsets[componentIdx].width;

            var y1 = (this.position.top + (iVisible*this.rowHeight))-cellOffset;
            var y2 = y1;

            this.ctx.fillStyle = this.color;

            if(i >= 0 && i < this.components[0].length){
                var rowTitle = componentRows[i];
                this.ctx.fillText(rowTitle, x1+20, parseInt(this.fontSize)+y1+(this.rowHeight/2-parseInt(this.fontSize)/2)-13, this.width); 
            }
            x++;
        }
        this.ctx.closePath();
        lastX += this.componentScrollOffsets[componentIdx].width;
    }
    
    this.ctx.beginPath();
    this.ctx.fillStyle = this.selectedRowBackgroundColor;
    this.ctx.rect(this.position.left+10, this.position.top+76,  this.width-20, this.rowHeight+5);
    this.ctx.fill();
    this.ctx.closePath();
    
    this.ctx.restore();
    
    this.checkForEvents();
}


UIPickerView.prototype.reloadAllComponents = function(reload){
    if(!reload) return;
    this.components.length = 0;
    this.componentScrollOffsets.length = 0;
    this.reloading = true;
    var that = this;
    this.numberOfComponentsCallback(function(components){
        for(var i = 0; i < components; i++){
            var component = [];
            that.components.push(component);
            that.componentScrollOffsets.push({offset: 0.0, adjusting: false, lastSelectedIdx: -1, width: 320, height: parseInt(that.fontSize)});
            function myFunc(component){
                that.rowSizeForComponentCallback(component, function(rowSize){
                    that.componentScrollOffsets[component].width = rowSize.width;
                    that.componentScrollOffsets[component].height = rowSize.height;
                    that.numberOfRowsInComponentCallback(i, function(rows){
                        for(var x = 0; x < rows; x++){
                            that.titleForRowCallback(x, component, function(title){
                                that.components[component].unshift(title);
                            });
                        }
                        that.reloading = false;
                    });
                });
                
                
            }
            myFunc(i);
        }        
    });
};

UIPickerView.prototype.titleForRow = function(callback){
    this.titleForRowCallback = callback;
};

UIPickerView.prototype.numberOfComponents = function(callback){
    this.numberOfComponentsCallback = callback;
};

UIPickerView.prototype.numberOfRowsInComponent = function(callback){
    this.numberOfRowsInComponentCallback = callback;
};

UIPickerView.prototype.didSelectRowInComponent = function(callback){
    this.didSelectRowInComponentCallback = callback;
}

UIPickerView.prototype.rowSizeForComponent = function(callback){
    this.rowSizeForComponentCallback = callback;
}


UIPickerView.prototype.indexPathForPoint = function(point) {
    var visibleRangeTop = 0;
    var clickOffset = this.scrollOffset / this.rowHeight +  (point.y / this.rowHeight);
    if (clickOffset > 0) {
        clickOffset = Math.floor(clickOffset);
    } else if (clickOffset < 0) {
        clickOffset = Math.ceil(clickOffset);
    }    
    return {section: 0, row: clickOffset};
}

UIPickerView.prototype.setRowHeight = function(rowHeight) {
    this.rowHeight = rowHeight;
}

UIPickerView.prototype.setColor = function(color) {
    this.color = color;
}

UIPickerView.prototype.setBackgroundColor = function(backgroundColor){
    this.backgroundColor = backgroundColor;
}

UIPickerView.prototype.setFont = function(font){
    this.font = font;
};

UIPickerView.prototype.setStyle = function(style){
    this.style = style;
};

UIPickerView.prototype.setFontSize = function(size){
    this.fontSize = size;
};

// End picker


UITableView.prototype = new UIControl();
UITableView.prototype.constructor = UITableView;

function UITableView(ctx){
    this.ctx = ctx;
    this.seperatorHeight = 1.5;
    this.backgroundColor = 'rgba(255,255,255,1)';
    this.seperatorColor = 'rgba(224,224,224,1)';
    this.color = 'rgba(0,0,0,1)';
    this.width = 60;
    this.height = 20;
    this.rowHeight = 44;
    this.fontSize = '16pt';
    this.style =  'bold';
    this.font =  'Helvetica';
    this.velocity = 0.0;
    this.headerHeight = 22.0;
    
    this.titleForRowAtIndexPathCallback = function(indexPath,callback){callback('')};
    this.numberOfSectionsCallback = function(callback){callback(0)};
    this.numberOfRowsInSectionCallback = function(section, callback){callback(0)};
    this.titleForHeaderInSectionCallback = function(section, callback){callback('')};
    this.didSelectRowAtIndexPathCallback = function(){};

    this.selectedIndexPaths = [];
    var that = this;
    this.scrollOffset = 0;
    
    this.sections = [];
    
    var mouseDownY = 0;
    var isMoving = false;
    var mouseDownOffset = 0;
    var mouseDownStart = 0;
    
    var downStart = {x: 0, y: 0};
    this.bind('mousedown', function(e){
        var date = new Date();
        mouseDownStart = date.getTime();
        isMoving = true;
        var y = e.surfaceY;
        mouseDownY = y;
        mouseDownOffset = that.scrollOffset;
        that.velocity = 0;
        downStart.x = e.surfaceX;
        downStart.y = e.surfaceY;
    });
    
    this.bind('mousemove', function(e){
        if(isMoving){
            
            var y = e.surfaceY;        
            var delta =  mouseDownY - y;
                        
            that.scrollOffset = mouseDownOffset + delta;
            if(that.scrollOffset < 0 ){
                that.scrollOffset = mouseDownOffset + (delta * (1.0-Math.abs(that.scrollOffset)/that.height));
            }

            if (that.scrollOffset + Math.min(that.height, that.visibleHeight()) > that.tableHeight()){
                that.scrollOffset = mouseDownOffset + (delta * (1.0-(that.scrollOffset + Math.min(that.height, that.visibleHeight()) - that.tableHeight())/that.height));
            }
        }
    });
    
    this.bind('mouseup', function(e){
        var y = e.surfaceY;
        var date = new Date();
        var timeDelta = date.getTime() - mouseDownStart;
        that.mouseUpTime = date.getTime();
        that.mouseUpScrollOffset = that.scrollOffset;
        
        var distDelta = mouseDownY - y;
        that.velocity = distDelta / (timeDelta / 1000);
        isMoving = false;
        
        if(that.scrollOffset < 0 ){
            that.bounceTop = true;
        }
        
        if (that.scrollOffset + that.height > that.tableHeight()){
            that.bounceBottom = true;
        }
        
        if ( Math.abs(Math.sqrt(Math.pow(downStart.x - e.surfaceX, 2) + Math.pow(downStart.y - e.surfaceY, 2))) < 2){
            var indexPath = that.indexPathForPoint({x: e.surfaceX, y: e.surfaceY});
            that.selectRowAtIndexPath(indexPath, false, 0);
            that.deselectRowAtIndexPath(indexPath, true);
        }
    });    
}

UITableView.prototype.visibleHeight = function() {
    var numberSections = 0;
    var numberRows = 0;
    var rowsOffset = this.scrollOffset / this.rowHeight;
    var visibleRangeTop = 0;
    if (rowsOffset > 0) {
        visibleRangeTop = Math.floor(rowsOffset);
    } else if (rowsOffset < 0) {
        visibleRangeTop = Math.ceil(rowsOffset);
    }
    
    var visibleRows = Math.ceil(this.height / this.rowHeight);
    var visibleRangeBottom = visibleRangeTop + visibleRows;
    
    for (var sectionIdx in this.sections){
        var section = this.sections[sectionIdx];
        if(section.title && section.title !== '' && numberRows >= visibleRangeTop  && numberRows <= visibleRangeBottom){
            numberSections++;
        }
        numberRows += section.rows.length;
    }
    return Math.min(numberRows,visibleRows) * this.rowHeight + numberSections * this.headerHeight;
}

UITableView.prototype.tableHeight = function() {
    var numberSections = 0;
    var numberRows = 0;
    var rowsOffset = this.scrollOffset / this.rowHeight;
    var visibleRangeTop = 0;
    if (rowsOffset > 0) {
        visibleRangeTop = Math.floor(rowsOffset);
    } else if (rowsOffset < 0) {
        visibleRangeTop = Math.ceil(rowsOffset);
    }
    
    var visibleRows = Math.ceil(this.height / this.rowHeight);
    var visibleRangeBottom = visibleRangeTop + visibleRows;
    
    for (var sectionIdx in this.sections){
        var section = this.sections[sectionIdx];
        if(section.title && section.title !== '' && numberRows >= visibleRangeTop  && numberRows <= visibleRangeBottom){  //height of table depends on how many headers are visible, not sure why but only way it works
            numberSections++;
        }
        numberRows += section.rows.length;
    }
    return numberRows * this.rowHeight + numberSections * this.headerHeight;
}

UITableView.prototype.draw = function() {
    this.ctx.save();
    var date = new Date();
     
    var percentOfOneSecond = ((date.getTime() - fezo.scene.lastFrameTime) / 1000);  
    
    if(this.bounceTop){
        this.velocity = 0.0;
        
        var yAdj = Math.easeOutQuart((new Date()).getTime()-this.mouseUpTime, 0, Math.abs(this.mouseUpScrollOffset), 500);
        this.scrollOffset = this.mouseUpScrollOffset + yAdj;
        
        if ((new Date()).getTime()-this.mouseUpTime > 500){
            this.scrollOffset = 0;
            this.bounceTop = false;
        }
    }
    
    if(this.bounceBottom){
        this.velocity = 0.0;
        
        var yAdj = Math.easeOutQuart((new Date()).getTime()-this.mouseUpTime, 0, this.mouseUpScrollOffset - (this.tableHeight() - Math.min(this.height, this.visibleHeight())), 500);
        this.scrollOffset = this.mouseUpScrollOffset - yAdj;
        
        if ((new Date()).getTime()-this.mouseUpTime > 500){
            this.scrollOffset = this.tableHeight() - Math.min(this.height, this.visibleHeight());
            this.bounceBottom = false;
        }
    }
    
    var velocityOffset = this.velocity * percentOfOneSecond;
    this.scrollOffset += velocityOffset
    this.velocity = this.velocity * 0.9;
    
    if(this.scrollOffset <= 0) {
        this.velocity = this.velocity * (1.0 - Math.abs(this.scrollOffset) / this.height);
    }
    
    
    if (Math.abs(this.velocity) <= 1.0 && this.velocity != 0.0){
        this.velocity = 0;
        if(this.scrollOffset < 0 ){
            this.bounce = true;
        }
        if (this.scrollOffset + this.height > this.tableHeight()){
            this.bounceBottom = true;
        }
    }
    
    this.ctx.beginPath();
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.rect(this.position.left, this.position.top,  this.width, this.height);
    this.ctx.fill();
    this.ctx.clip();
    this.ctx.closePath();
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.seperatorColor;
    this.ctx.lineWidth = this.seperatorHeight;
    var visibleRows = Math.ceil(this.height / this.rowHeight);
    
    var rowsOffset = this.scrollOffset / this.rowHeight;
    var visibleRangeTop = 0;
    if (rowsOffset > 0) {
        visibleRangeTop = Math.floor(rowsOffset);
    } else if (rowsOffset < 0) {
        visibleRangeTop = Math.ceil(rowsOffset);
    }
    
    var visibleRangeBottom = visibleRangeTop + visibleRows;
    
    var cellOffset = this.scrollOffset % this.rowHeight;
    
    var lastY = 0;
    
    var x = 0;
    for(var i = visibleRangeTop; i < visibleRangeBottom; i++){
        var indexPath = this.indexPathFromCombinedIndex(i);

        if(indexPath && !(!this.sections[indexPath.section].title ||this.sections[indexPath.section].title === '')  && indexPath.row == 0){
            var headerBackgroundColor = this.ctx.createLinearGradient(0,(this.position.top + lastY)-cellOffset,0,((this.position.top + lastY)-cellOffset)+this.headerHeight);
            headerBackgroundColor.addColorStop(0.0, '#a5b1ba');
            headerBackgroundColor.addColorStop(0.04545454545455, '#a5b1ba');
            headerBackgroundColor.addColorStop(0.05, '#909faa');
            headerBackgroundColor.addColorStop(0.62, '#adb8c0');
            headerBackgroundColor.addColorStop(0.95, '#b8c1c8');
            headerBackgroundColor.addColorStop(0.95454545454545, '#989ea4');
            headerBackgroundColor.addColorStop(1.00, '#989ea4');
            
            this.ctx.beginPath();
            this.ctx.fillStyle = headerBackgroundColor;
            this.ctx.rect(this.position.left, (this.position.top + lastY)-cellOffset, this.width, this.headerHeight);
            this.ctx.fill();
            this.ctx.closePath();
            
            this.ctx.beginPath();
            this.ctx.font = this.style + " 14pt " + this.font;
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)'
            this.ctx.fillText(this.sections[indexPath.section].title, this.position.left+20, 1+(this.headerHeight-(this.headerHeight-14)/2)+(this.position.top + lastY)-cellOffset, this.width); 
            this.ctx.fillStyle = '#FFF'
            this.ctx.fillText(this.sections[indexPath.section].title, this.position.left+20, (this.headerHeight-(this.headerHeight-14)/2)+(this.position.top + lastY)-cellOffset, this.width); 
            this.ctx.closePath();
            lastY += this.headerHeight;
        }
        
        var iVisible = x;
        var x1 = this.position.left;
        var x2 = x1 + this.width;
        
        var y1 = (this.position.top + lastY)-cellOffset;
        var y2 = y1;
        
        this.ctx.beginPath();
        var selected = false;
        var deselecting = false;
        var deselectingStart = 0;
        var selectedIdx = 0;
        for(var idx in this.selectedIndexPaths){
            if(indexPath && this.selectedIndexPaths[idx].ip.section == indexPath.section && this.selectedIndexPaths[idx].ip.row == indexPath.row){
                selectedIdx = idx;
                selected = true;
                deselecting = this.selectedIndexPaths[idx].deselecting;
                deselectingStart = this.selectedIndexPaths[idx].deselectingStart;
                break;
            }
        }
        if(selected){
            var lingrad = this.ctx.createLinearGradient(x1,y1,this.width,this.height);
            if(!deselecting){
                lingrad.addColorStop(0, "rgba(5,138,245,1.0)");
                lingrad.addColorStop(1, "rgba(1,95,231,1.0)");
            } else {
                var delta = (new Date().getTime()-deselectingStart);
                var alpha = 1.0 - (delta / 500);
                lingrad.addColorStop(0, "rgba(5,138,245," + alpha + ")");
                lingrad.addColorStop(1, "rgba(1,95,231," + alpha + ")");
                if(delta > 500){
                    this.selectedIndexPaths.splice(selectedIdx, 1);
                }
            }
            this.ctx.fillStyle = lingrad;
            this.ctx.rect(x1, y1, this.width, this.rowHeight);
            this.ctx.fill();
        }
        this.ctx.closePath();

        this.ctx.fillStyle = this.color;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.closePath();
        
        this.ctx.beginPath();
        if(!this.reloading && indexPath){
            this.ctx.font = this.style + " " + parseInt(this.fontSize) + "pt " + this.font;
            this.ctx.fillText(this.sections[indexPath.section].rows[indexPath.row], x1+20, parseInt(this.fontSize)+y1+(this.rowHeight/2-parseInt(this.fontSize)/2), this.width); 
        }
        this.ctx.closePath();
        x++;
        lastY += this.rowHeight;
    }
    this.ctx.restore();
    this.checkForEvents();
}

UITableView.prototype.indexPathFromCombinedIndex = function(combinedIdx){
    if(combinedIdx < 0) return null;
    var sectionIdx = -1;
    var currentCount = 0;
    for(var sectionIdx = 0; sectionIdx < this.sections.length; sectionIdx++){
        if (combinedIdx < currentCount + this.sections[sectionIdx].rows.length){
            return {section: sectionIdx, row: combinedIdx-currentCount}
        } else {
            currentCount += this.sections[sectionIdx].rows.length;
        }
    }
    return null;
}

UITableView.prototype.reloadData = function(reload){
    if(!reload) return;
    this.sections.length = 0;
    this.reloading = true;
    var that = this;
    this.numberOfSectionsCallback(function(sections){
        for(var i = 0; i < sections; i++){
            var section = {title: '', rows: []};
            that.sections.push(section);
            var myfunc = function(sectionIdx){
                that.titleForHeaderInSectionCallback(sectionIdx, function(title){
                    that.sections[sectionIdx].title = title;
                    that.numberOfRowsInSectionCallback(sectionIdx, function(rows){
                        for(var x = 0; x < rows; x++){
                            var myfunc2 = function(rowIdx){
                                that.titleForRowAtIndexPathCallback({section: sectionIdx, row: rowIdx}, function(title){
                                    that.sections[sectionIdx].rows.unshift(title);
                                    that.reloading = false;
                                });
                            }(x);
                        }
                    });
                });
            }
            myfunc(i);
        }
    });
};

UITableView.prototype.didSelectRowAtIndexPath = function(callback){
    this.didSelectRowAtIndexPathCallback = callback;
}

UITableView.prototype.deselectRowAtIndexPath = function(indexPath, animated){
    var ipIdx = -1;
    for(var idx in this.selectedIndexPaths){
        if(this.selectedIndexPaths[idx].ip.row === indexPath.row && this.selectedIndexPaths[idx].ip.section === indexPath.section){
            ipIdx = idx;
            break;
        }
    }
    if(ipIdx > -1){
        if(!animated){
            this.selectedIndexPaths.splice(ipIdx, 1);
        } else {
            this.selectedIndexPaths[ipIdx].deselecting = true;
            this.selectedIndexPaths[ipIdx].deselectingStart = new Date().getTime();
        }
        
    }
}

UITableView.prototype.selectRowAtIndexPath = function(indexPath, animated, scrollPosition){
    for(var selectedIndexPathIdx in this.selectedIndexPaths){
        if(this.selectedIndexPaths[selectedIndexPathIdx].ip.row == indexPath.row && this.selectedIndexPaths[selectedIndexPathIdx].ip.section == indexPath.section){
            this.selectedIndexPaths.splice(selectedIndexPathIdx, 1);
        }
    }
    this.selectedIndexPaths.push({ip: indexPath, deselecting: false});
    if(this.didSelectRowAtIndexPathCallback){
        this.didSelectRowAtIndexPathCallback(indexPath);
    }
}

UITableView.prototype.indexPathForPoint = function(point) {
    point.y += this.scrollOffset;
    var numberSections = 0;
    var numberRows = 0;
    var rowsOffset = this.scrollOffset / this.rowHeight;
    var visibleRangeTop = 0;
    if (rowsOffset > 0) {
        visibleRangeTop = Math.floor(rowsOffset);
    } else if (rowsOffset < 0) {
        visibleRangeTop = Math.ceil(rowsOffset);
    }
    
    var visibleRows = Math.ceil(this.height / this.rowHeight);
    var visibleRangeBottom = visibleRangeTop + visibleRows;
    
    var sectionIdx = 0;
    for (var i in this.sections){
        sectionIdx = i;
                
        var section = this.sections[i];
        if(section.title && section.title !== '' && numberRows >= visibleRangeTop  && numberRows <= visibleRangeBottom){  //height of table depends on how many headers are visible, not sure why but only way it works
            numberSections++;
        }
        numberRows += section.rows.length;
        
        var currentY = numberRows * this.rowHeight + numberSections * this.headerHeight;
        if(point.y < currentY){
            currentY = (numberRows-section.rows.length) * this.rowHeight + numberSections * this.headerHeight;
            currentYBefore = currentY;
            for(var row = 0; row <= section.rows.length; row++){
                currentY = currentYBefore + row * this.rowHeight;
                if(point.y < currentY){
                    return {section: sectionIdx, row: row-1};
                }
            }
            break;
        }
    }
    return null;
    /*
    var visibleRangeTop = 0;
    var clickOffset = this.scrollOffset / this.rowHeight +  (point.y / this.rowHeight);
    if (clickOffset > 0) {
        clickOffset = Math.floor(clickOffset);
    } else if (clickOffset < 0) {
        clickOffset = Math.ceil(clickOffset);
    }    
    return {section: 0, row: clickOffset};*/
}

UITableView.prototype.titleForRowAtIndexPath = function(callback){
    this.titleForRowAtIndexPathCallback = callback;
};

UITableView.prototype.numberOfSections = function(callback){
    this.numberOfSectionsCallback = callback;
};

UITableView.prototype.numberOfRowsInSection = function(callback){
    this.numberOfRowsInSectionCallback = callback;
};

UITableView.prototype.titleForHeaderInSection = function(callback){
    this.titleForHeaderInSectionCallback = callback;
};

UITableView.prototype.didSelectRowAtIndexPath = function(callback){
    this.didSelectRowAtIndexPathCallback = callback;
};

UITableView.prototype.setRowHeight = function(rowHeight) {
    this.rowHeight = rowHeight;
}

UITableView.prototype.setColor = function(color) {
    this.color = color;
}

UITableView.prototype.setBackgroundColor = function(backgroundColor){
    this.backgroundColor = backgroundColor;
}

UITableView.prototype.setFont = function(font){
    this.font = font;
};

UITableView.prototype.setStyle = function(style){
    this.style = style;
};

UITableView.prototype.setFontSize = function(size){
    this.fontSize = size;
};

function UIButton(ctx) {
    this.ctx = ctx;
    this.border = 1;
    this.backgroundColor = 'rgba(255,255,255,1)';
    this.borderColor = 'rgba(173,173,173,1)';
    this.color = 'rgba(69,105,154,1)';
    this.radius = 9;
    this.width = 60;
    this.height = 20;
    this.title = 'Lorem Ipsum'
    var that = this;
    this.text = new UIText(ctx);  
}

UIButton.prototype = new UIControl();
UIButton.prototype.constructor = UIButton;
UIButton.prototype.draw = function() {
    switch(this.state){
        case UIControl.stateHighlighted:
            var lingrad = this.ctx.createLinearGradient(0,0,0,this.position.top+this.height);
            lingrad.addColorStop(0, "rgba(5,138,245,1.0)");
            lingrad.addColorStop(1, "rgba(1,95,231,1.0)");
            this.ctx.fillStyle = lingrad;
            this.ctx.lineWidth = this.border;
            this.ctx.strokeStyle = this.borderColor;
            this.text.setColor("rgba(255,255,255,1.0)");
            break;
        case UIControl.stateNormal:
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.lineWidth = this.border;
            this.ctx.strokeStyle = this.borderColor;
            this.text.setColor(this.color);
            break;
    }
    this.ctx.beginPath();
    this.ctx.moveTo(this.position.left + this.radius, this.position.top);
    this.ctx.lineTo(this.position.left + this.width - this.radius, this.position.top);
    this.ctx.quadraticCurveTo(this.position.left + this.width, this.position.top, this.position.left + this.width, this.position.top + this.radius);
    this.ctx.lineTo(this.position.left + this.width, this.position.top + this.height - this.radius);
    this.ctx.quadraticCurveTo(this.position.left + this.width, this.position.top + this.height, this.position.left + this.width - this.radius, this.position.top + this.height);
    this.ctx.lineTo(this.position.left + this.radius, this.position.top + this.height);
    this.ctx.quadraticCurveTo(this.position.left, this.position.top + this.height, this.position.left, this.position.top + this.height - this.radius);
    this.ctx.lineTo(this.position.left, this.position.top + this.radius);
    this.ctx.quadraticCurveTo(this.position.left, this.position.top, this.position.left + this.radius, this.position.top);
    this.ctx.closePath();
    if (this.border) {
        this.ctx.stroke();
    }
    this.ctx.fill();
    this.checkForEvents();
    
    this.text.setText(this.title);
    this.text.setPosition({top: (this.height-parseInt(this.text.fontSize))/2, left: (this.width-parseInt(this.text.textWidth()))/2});
    this.text.setWidth(this.width);
    this.text.setHeight(parseInt(this.text.fontSize));
    this.text.draw();
}

UIButton.prototype.setTitle = function(title) {
    this.title = title;
}

UIButton.prototype.setColor = function(color) {
    this.color = color;
}

UIButton.prototype.setRadius = function(radius) {
    this.radius = radius;
}

UIButton.prototype.setBackgroundColor = function(backgroundColor){
    this.backgroundColor = backgroundColor;
}

UIButton.prototype.setBorder = function(border){
    this.border = border;
}

function UIText(ctx){
    this.changeCallbacks = [];
    this.ctx = ctx;
    this.text = 'Lorem Ipsum';
    this.style =  '';
    this.font =  'Helvetica';
    if (/Opera[\/\s](\d+\.\d+)/.test(navigator.userAgent)){
        this.font = 'arial'; //Opera and helvetica don't play nicely =(
    }
    this.fontSize = '12pt';
    this.align = 'left';
    this.color = 'rgba(255,255,255,1)';
    this.backDropColor = 'rgba(0,0,0,1)';
    this.cusorLeft = 0;
    this.editable = false;
    this.isEditing = false;
    this.maxWidth = 0;
    this.cursor = 0;
    var that = this;
    this.cursorPosition = -1;
    this.backdrop = true;
    
    this.onKeyPress = function(e){
        var keyCode = e.which||e.charCode||e.keyCode;
        var keychar = String.fromCharCode(keyCode);
        
        if([8,46,37,39,32].indexOf(keyCode) !== -1){
            return;
        }
            
        var pre = that.text.slice(0,that.cursorPosition);
        var post = that.text.slice(that.cursorPosition);
        
        that.text = pre + keychar + post;
        that.cursor = that.textWidth(pre + keychar);
        that.cursorPosition++;
        if(that.changeCallbacks.length > 0 && UIControl.firstResponder == that){
            var evt = document.createEvent("Event")
            evt.initEvent("onChange",false,false);
            for(var i = 0, iLen = that.changeCallbacks.length; i<iLen; i++){
                that.changeCallbacks[i](evt);
            }
        }
        that.calcualteCusorLeft();
    }

    this.onKeyDown = function(e){
        var keyCode = e.which||e.charCode||e.keyCode;
        
        if(keyCode == 8 || keyCode == 46){ //backspace and delete
            e.preventDefault();
            var pre = that.text.slice(0,that.cursorPosition-1);
            var post = that.text.slice(that.cursorPosition);
            that.cursor = that.textWidth(pre);
            that.text = pre + post;
            that.cursorPosition--;
            if(that.changeCallbacks.length > 0){
                var evt = document.createEvent("Event")
                evt.initEvent("onChange",false,false);
                for(var i = 0, iLen = that.changeCallbacks.length; i<iLen; i++){
                    that.changeCallbacks[i](evt);
                }
            }
            that.calcualteCusorLeft();
        } else if (keyCode == 37) { //left arrow
            e.preventDefault();
            if(that.cursorPosition > 0){
                that.cursorPosition--;
                that.cursor = that.textWidth(that.text.slice(0,that.cursorPosition));
            }
        } else if (keyCode == 39) { //right arrow
            e.preventDefault();
            if(that.cursorPosition < that.text.length){
                that.cursorPosition++;
                that.cursor = that.textWidth(that.text.slice(0,that.cursorPosition));
            }            
        } else if (keyCode == 32) { //space bar (does weird scrolling)
            e.preventDefault();
            var pre = that.text.slice(0,that.cursorPosition);
            var post = that.text.slice(that.cursorPosition);
            that.text = pre + " " + post;
            that.cursor = that.textWidth(pre + " ");
            that.cursorPosition++;
            if(that.changeCallbacks.length > 0){
                var evt = document.createEvent("Event")
                evt.initEvent("onChange",false,false);
                for(var i = 0, iLen = that.changeCallbacks.length; i<iLen; i++){
                    that.changeCallbacks[i](evt);
                }
            }
            that.calcualteCusorLeft();
        }
    }
    
    this.bind('mouseup', function(e){
        if(this.editable){
            var i = 0;
            var matchingX = e.surfaceX - this.cusorLeft; //(alignment handling)
            var textCopy = this.text;
            var currentDist = 100000;
            while(textCopy.length >= 0 && this.text.length-i >= 0){
                textCopy = textCopy.slice(0,this.text.length-i);
                var loc = this.textWidth(textCopy);
                if (Math.abs(loc-matchingX) < currentDist){
                    currentDist = Math.abs(loc-matchingX);
                    this.cursorPosition = this.text.length-i;
                }
                i++;
            }
            this.isEditing = true;
            this.editCursorOff = false;
            this.cursor = this.textWidth(this.text.slice(0,this.cursorPosition));
        }
    }, true, true);
}

UIText.prototype = new UIControl();
UIText.prototype.constructor = UIText;

UIText.prototype.change = function(callback){
    this.changeCallbacks.push(callback);
};

UIText.prototype.canBecomeFirstResponder = function(){
    this.unbind('keypress', this.onKeyPress);
    this.unbind('keydown', this.onKeyDown);
    this.bind('keypress', this.onKeyPress, true, true);
    this.bind('keydown', this.onKeyDown, true, true);
    return true;
};

UIText.prototype.willResignFirstResponder = function(){
    this.unbind('keypress', this.onKeyPress);
    this.unbind('keydown', this.onKeyDown);
};

UIText.prototype.calcualteCusorLeft = function(){
    if(this.align === 'left'){
        this.cusorLeft = 0;
    } else if(this.align === 'right'){
        this.cusorLeft = this.width-this.textWidth();
    } else if(this.align === 'center'){
        this.cusorLeft = (this.width-this.textWidth())/2;
    } 
};

UIText.prototype.setAlign = function(align){
    this.align = align;
    this.calcualteCusorLeft();
};

UIText.prototype.setPosition = function(position){
    this.position = position;
    this.calcualteCusorLeft();
};

UIText.prototype.setText = function(text){
    this.text = text;
};

UIText.prototype.getText = function(text){
    return this.text;
};

UIText.prototype.setFont = function(font){
    if (font.match(/Helvetica/i) && /Opera[\/\s](\d+\.\d+)/.test(navigator.userAgent)){
        font = 'arial'; //Opera and helvetica don't play nicely =(
    }
    this.font = font;
};

UIText.prototype.setStyle = function(style){
    this.style = style;
};

UIText.prototype.setFontSize = function(size){
    this.fontSize = size;
};

UIText.prototype.enableBackDrop = function(enabled) {
    this.backdrop = enabled;
}

UIText.prototype.setColor = function(color){
    this.color = color;
};

UIText.prototype.setBackDropColor = function(color){
    this.backDropColor = color;
}

UIText.prototype.setEditable = function(editable){
    this.editable = editable;
};

UIText.prototype.textWidth = function(text){
    if(typeof(text) === 'undefined'){
        text = this.text;
    }
    var width = -1;
    var prevFont = this.ctx.font;
    var prevFill = this.ctx.fillStyle;
    this.ctx.font = this.style + " " + parseInt(this.fontSize) + "pt " + this.font;
    this.ctx.textAlign = this.align;
    this.ctx.fillStyle = this.color;
    width = this.ctx.measureText(text).width;
    this.ctx.font = prevFont;
    this.ctx.fillStyle = prevFill;
    return width;
}

UIText.prototype.draw = function(){
    this.ctx.textAlign = 'left';
    this.ctx.font = this.style + " " + parseInt(this.fontSize) + "pt " + this.font;
    if(this.maxWidth){
        if(this.backdrop){
            this.ctx.fillStyle = this.backDropColor;
            this.ctx.fillText(this.text, this.cusorLeft+this.position.left+0.5, parseInt(this.fontSize)+this.position.top-1, this.maxWidth); 
        }
        this.ctx.fillStyle = this.color;
       this.ctx.fillText(this.text, this.cusorLeft+this.position.left+0.5, parseInt(this.fontSize)+this.position.top, this.maxWidth); 
    } else {
        if(this.backdrop){
            this.ctx.fillStyle = this.backDropColor;
            this.ctx.fillText(this.text, this.cusorLeft+this.position.left+0.5, parseInt(this.fontSize)+this.position.top-1);
        }
        this.ctx.fillStyle = this.color;
        this.ctx.fillText(this.text, this.cusorLeft+this.position.left+0.5, parseInt(this.fontSize)+this.position.top);
    }
    if(this.isEditing && UIControl.firstResponder == this){
        if(!this.editCursorOff){
            this.ctx.beginPath();
            var cleanLine = 0.5;

            this.ctx.lineWidth = '1.0';
            this.ctx.strokeStyle = 'rgba(255,255,255,1)';
            this.ctx.fillStyle = 'rgba(255,255,255,1)';
            this.ctx.moveTo(0.5+this.position.left+Math.floor(this.cusorLeft)+this.cursor,this.position.top-2);  
            this.ctx.lineTo(0.5+this.position.left+Math.floor(this.cusorLeft)+this.cursor,this.position.top+parseInt(this.fontSize)+2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.lineWidth = '1.0';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
            this.ctx.fillStyle = 'rgba(0,0,0,1)';
            this.ctx.moveTo(this.position.left+Math.floor(this.cusorLeft)+this.cursor-0.5,this.position.top-2);
            this.ctx.lineTo(this.position.left+Math.floor(this.cusorLeft)+this.cursor-0.5,this.position.top+parseInt(this.fontSize)+2);
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        if(typeof(this.lastCursorBlink) === 'undefined' || new Date().getTime() - this.lastCursorBlink > 500){
            this.lastCursorBlink = new Date().getTime();
            if(this.editCursorOff){
                this.editCursorOff = false;
            } else {
                this.editCursorOff = true;
            }
        }
    }
    this.checkForEvents();
};
