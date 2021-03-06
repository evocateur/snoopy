
;(function( window, document, undefined ){

    var doc     = document,
        body    = doc.body,
        q_cache = {},
        isMobile = (function(){
            var ua = navigator.userAgent;
            return (ua.match(/iPhone/i) || ua.match(/iPod/i) || ua.match(/iPad/i)) ? true : false;
        })(),
        viewport = getViewportDimensions(),
        snoopy, modules, config, templates, snoopQuery;

    config = {
        NAME            : 'Snoopy',
        VERSION         : '0.2',
        START_OFFSET    : { top : '0', left : '0' }
    };

    snoopy = {

        elem            : null,
        modules_html    : '',
        raw_source      : '',
        gen_source      : '',
        bind_stack      : [],
        position        : config.START_OFFSET,

        init : function()
        {
            var self = this,
                el = this.elem = $('<div />'),
                snpy;

            el.attr('id', 'snpy').addClass('cleanslate');

            if ( isMobile ) el.addClass('MobileSafari');

            el.style('top', this.position.top, true);
            el.style('left', this.position.left, true);

            if ( viewport.width == 320 || viewport.width == 480 )
            {
                body.scrollTop = 0;
                hideURLBar();
            }

            this.runTests();
            this.getRawSource();
            this.getGeneratedSource();

            el.html(tim(templates.snoopy, {
                        name             : config.NAME,
                        modules          : this.modules_html,
                        version          : config.VERSION,
                        generated_source : this.gen_source
                    }));

            $(body).append(el);

            this.setMaxDimensions();
            this.bindEvents();
        },

        runTests : function()
        {
            var results = Sniffer.run(),
                output;

            for ( group in results )
            {
                var positive = 0;

                output = '<h2>'+results[group].description+'</h2><ul class="tests">';

                for ( test in results[group].results )
                {
                    var res = results[group].results[test];
                    output += '<li class="'+( res ? 'positive' : 'negative' )+'">';
                    output += '<span class="test_for">'+test+'</span>';
                    output += '<span class="test_result '+( res === true ? 'true_no_detail' : (!!res).toString() )+'">'+( res === true ? '-' : res.toString() )+'</span></li>';
                    if ( res ) positive++;
                }
                output += '</ul>';
                this.modules_html += '<div class="module'+( positive ? '' : ' empty' )+' type_'+group+' output_'+results[group].return_type+'">'+output+'</div>';
            }
        },

        getRawSource : function()
        {
            var self = this;
            ajax({
                type        : 'GET',
                url         : location.href,
                onSuccess   : function( data ){
                     self.raw_source = floodlight(floodlight.decode(data));
                     $('#snpy_rawsource code.html').html(self.raw_source);
                }
            });
        },

        getGeneratedSource : function()
        {
            this.gen_source = floodlight(floodlight.decode(doc.documentElement.innerHTML.toString()));
        },

        bindEvents : function( bindStack )
        {
            var self = this,
                el   = this.elem;


            $('#snpy .close').bind('click', function(){
                el.addClass('closed');
                return false;
            });

            $(window).bind('resize', function(){
                self.setMaxDimensions();
            });


            var tabs = $('#snpy .menu li'),
                panels = $('#snpy .panel');

            tabs.each(function(){
                $(this).bind('click', function(e){
                    var self = $(this);
                    tabs.removeClass('active');
                    panels.removeClass('active');
                    self.addClass('active');
                    $($(e.target).attr('href')).addClass('active');
                    return false;
                });
            });


            for ( var d, i = -1; d = this.bind_stack[++i]; ) d();
        },

        setMaxDimensions : function()
        {
            viewport = getViewportDimensions();
            if ( isMobile ) this.elem.style('max-width', (viewport.width - parseInt(config.START_OFFSET.left)*2)+'px', true);
            if ( viewport.width != 320 && viewport.width != 480 )
            {
                $('#snpy pre.source').style('max-height', (viewport.height - 180 - parseInt(config.START_OFFSET.top)*2)+'px', true);
            }
            else if (viewport.width == 320)
            {
                $('#snpy pre.source').style('height', '300px', true);
            }
            else if (viewport.width == 480)
            {
                $('#snpy pre.source').style('height', '150px', true);
            }
        }

    };

    templates = {

        snoopy : "\
<div class=\"head\">\
    <a class=\"close\" href=\"#\">close</a>\
    <h1>{{name}}</h1>\
</div>\
<div class=\"body\">\
    <ul class=\"menu tabs\">\
        <li class=\"active\"><a href=\"#snpy_overview\">overview</a></li>\
        <li><a href=\"#snpy_rawsource\">view source</a></li>\
        <li><a href=\"#snpy_gensource\"><span class=\"no320\">view</span> generated source</a></li>\
    </ul>\
    <div class=\"panels\">\
        <div id=\"snpy_overview\" class=\"panel active\">{{modules}}</div>\
        <div id=\"snpy_rawsource\" class=\"panel\">\
<p class=\"tip MobileSafari\">Tip: Use a two fingered drag to scroll the code.</p>\
        <pre class=\"source raw\"><code class=\"html\">loading source code...</code></pre></div>\
        <div id=\"snpy_gensource\" class=\"panel\">\
<p class=\"tip MobileSafari\">Tip: Use a two fingered drag to scroll the code.</p>\
<pre class=\"source generated\"><code class=\"html\">{{generated_source}}</code></pre></div>\
    </div>\
</div>\
<div class=\"footer\">\
    <p><a href=\"http://github.com/allmarkedup/Snoopy\">Snoopy <span class=\"version\">v{{version}}</span></a>. Created by <a href=\"http://allmarkedup.com/\">Mark Perkins</a>.</p>\
</div>"

    };


    /*
     * Sniffer - sniffs web pages to extract information such as JS libraries, CMS, analytics packages, etc.
     * Author: Mark Perkins, mark@allmarkedup.com
     */

    var Sniffer = (function( win, doc, undefined ){

        var sniff       = {},
            detect      = {},
            pageinfo     = {},
            test_runner = {},
            results     = {},
            indexed_results = {},
            scripts     = doc.getElementsByTagName("script"),
            metas       = doc.getElementsByTagName("meta"),
            html        = doc.documentElement.outerHTML || doc.documentElement.innerHTML,
            doctype     = doc.doctype,
            has_run     = false;

        metas = (function(){
            for ( var meta, temp = [], i = -1; meta = metas[++i]; )
            {
                if ( meta.name && meta.content ) temp.push(meta);
            }
            return temp;
        })();

        scripts = (function(){
            for ( var script, temp = [], i = -1; script = scripts[++i]; )
            {
                if ( script.src ) temp.push(scripts);
            }
            return temp;
        })();

        /* page component detection tests */

        detect.pageinfo = {

            description : 'Page information',

            return_type : 'detail',

            tests : {

                'Doctype' : [
                    {
                        type : 'doctype', // source: http://www.w3.org/QA/2002/04/valid-dtd-list.html
                        test : {
                            'HTML5'                    : { name : 'html', publicId : '' },
                            'HTML 4.01 Strict'         : { name : 'html', publicId : '-//W3C//DTD HTML 4.01//EN' },
                            'HTML 4.01 Transitional'   : { name : 'html', publicId : '-//W3C//DTD HTML 4.01 Transitional//EN' },
                            'XHTML 1.0 Strict'         : { name : 'html', publicId : '-//W3C//DTD XHTML 1.0 Strict//EN' },
                            'XHTML 1.0 Transitional'   : { name : 'html', publicId : '-//W3C//DTD XHTML 1.0 Transitional//EN' },
                            'XHTML 1.0 Frameset'       : { name : 'html', publicId : '-//W3C//DTD XHTML 1.0 Frameset//EN' },
                            'XHTML 1.1'                : { name : 'html', publicId : '-//W3C//DTD XHTML 1.1//EN' },
                            'HTML 2.0'                 : { name : 'html', publicId : '-//IETF//DTD HTML 2.0//EN' },
                            'HTML 3.0'                 : { name : 'html', publicId : '-//W3C//DTD HTML 3.2 Final//EN' },
                            'XHTML 1.0 Basic'          : { name : 'html', publicId : '-//W3C//DTD XHTML Basic 1.0//EN' }
                        }
                    }
                ],
                'Charset' : [
                    {
                        type : 'custom',
                        test : function(){ return doc.characterSet || 'None detected'; }
                    }
                ]
            }

        };

        detect.js_libs = {

            description : 'JavaScript Libraries',

            return_type : 'version',

            tests : {

                'jQuery' : [
                    {
                        type : 'custom',
                        test : function(){ return win.jQuery ? win.jQuery.fn.jquery : false; }
                    }
                ],
                'jQuery UI' : [
                    {
                        type : 'custom',
                        test : function(){ return win.jQuery && win.jQuery.ui ? win.jQuery.ui.version : false; }
                    }
                ],
                'Prototype' : [
                    {
                        type : 'custom',
                        test : function(){ return win.Prototype ? win.Prototype.Version : false; }
                    }
                ],
                'Scriptaculous' : [
                    {
                        type : 'custom',
                        test : function(){ return win.Scriptaculous ? win.Scriptaculous.Version : false; }
                    }
                ],
                'MooTools' : [
                    {
                        type : 'custom',
                        test : function(){ return win.MooTools ? win.MooTools.version : false; }
                    }
                ],
                'Glow' : [
                    {
                        type : 'custom',
                        test : function(){ return win.glow ? win.glow.VERSION : false; }
                    }
                ],
                'Dojo' : [
                    {
                        type : 'custom',
                        test : function(){ return win.dojo ? win.dojo.version.toString() : false; }
                    }
                ],
                'ExtJS' : [
                    {
                        type : 'custom',
                        test : function(){ return win.Ext ? win.Ext.version : false; }
                    }
                ],
                'YUI' : [
                    {
                        type : 'custom',
                        test : function(){ return win.YAHOO ? win.YAHOO.VERSION : false; }
                    }
                ],
                'Google Closure' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.goog; } // need to figure out how to get Closure version
                    }
                ],
                'Modernizr' : [
                    {
                        type : 'custom',
                        test : function(){ return win.Modernizr ? win.Modernizr._version : false; }
                    }
                ],
                'Raphael' : [
                    {
                        type : 'custom',
                        test : function(){ return win.Raphael ? win.Raphael.version : false; }
                    }
                ]

            }
        };

        detect.cms = {

            description : 'Content Management System',

            return_type : 'version',

            tests : {

                'Wordpress' : [
                    {
                        type : 'meta',
                        test : { name : 'generator', match : /WordPress\s?([\w\d\.\-_]*)/i }
                    },
                    {
                        type : 'text',
                        test : /<link rel=["|']stylesheet["|'] [^>]+wp-content/i
                    }
                ],
                'Typepad' : [
                    {
                        type : 'meta',
                        test : { name : 'generator', match : /typepad\.com/i }
                    }
                ],
                'Joomla' : [
                    {
                        type : 'meta',
                        test : { name : 'generator', match : /joomla\!?\s?([\d.]*)/i }
                    }
                ],
                'Blogger' : [
                    {
                        type : 'meta',
                        test : { name : 'generator', match : /blogger/i }
                    }
                ],
                'MovableType' : [
                    {
                        type : 'meta',
                        test : { name : 'generator', match : /Movable Type Pro ([\d.]*)/i }
                    }
                ],
                'Drupal' : [
                    {
                        type : 'custom',
                        test : function() { return win.Drupal ? true : false; } // no version in js obj
                    }
                ],
                'Cisco Eos' : [
                    {
                        type : 'custom',
                        test : function() { return win.eos ? true : false; } // no version in js obj
                    },
                    {
                        type : 'text',
                        test : /<link rel=["|']stylesheet["|'] [^>]+ciscoeos.com/i
                    }
                ]
            }

        };

        detect.analytics = {

            description : 'Analytics',

            return_type : 'version',

            tests : {

                'Google Analytics' : [
                    {
                        type : 'custom',
                        test : function(){ return !! (win._gat || win._gaq); }
                    }
                ],
                'Reinvigorate' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.reinvigorate; }
                    }
                ],
                'Piwik' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.Piwik; }
                    }
                ],
                'Clicky' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.clicky; }
                    }
                ],
                'Open Web Analytics' : [
                    {
                        type : 'custom',
                        test : function() { return !! win.OWA; }
                    }
                ]
            }

        };

        detect.fonts = {

            description : 'Fonts',

            return_type : 'version',

            tests : {

                'Cufon' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.Cufon }
                    }
                ],
                'Typekit' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.Typekit }
                    }
                ],
                'Fontdeck' : [
                    {
                        type : 'text',
                        test : /<link rel=["|']stylesheet["|'] [^>]+f.fontdeck.com/i
                    }
                ],
                'Google Webfonts' : [
                    {
                        type : 'custom',
                        test : function(){ return !! win.WebFont }
                    }
                ],
                'sIFR' : [
                    {
                        type : 'custom',
                        test : function(){ return win.sIFR ? win.sIFR.VERSION : false }
                    }
                ]
            }

        };


        /* test runners */

        test_runner.custom = function( test )
        {
            return test();
        }

        test_runner.text = function( test )
        {
            return match( html, test );
        }

        if ( doctype )
        {
            test_runner.doctype = function( test )
            {
                for ( subtest in test )
                {
                    if ( test.hasOwnProperty(subtest) )
                    {
                        var t = test[subtest];

                        if ( doctype.name.toLowerCase() == t.name && doctype.publicId == t.publicId )
                        {
                            return subtest;
                        }
                    }
                }
                return false;
            }
        }
        else
        {
            test_runner.doctype = function(){
                return 'None detected';
            }
        }

        if ( scripts.length )
        {
            test_runner.script = function( test )
            {
                for ( var script, i = -1; script = scripts[++i]; )
                {
                    return match( script.src, test );
                }
                return false;
            }
        }
        else
        {
           test_runner.script = function(){ return false; }
        }

        if ( metas.length )
        {
            test_runner.meta = function( test )
            {
                for ( var meta, i = -1; meta = metas[++i]; )
                {
                    if ( meta.name == test.name )
                    {
                        var res = match( meta.content, test.match );
                        if ( res ) return res;
                    }
                }
                return false;
            }
        }
        else
        {
            test_runner.meta = function(){ return false; }
        }

        function match( str, test )
        {
            var match = str.match(test);
            if ( match ) return match[1] && match[1] != '' ? match[1] : true; // return version number if poss or else true.
            return false;
        }

        /* main function responsible for running the tests */

        var run = function( tests_array )
        {
            for ( var check, i = -1; check = tests_array[++i]; )
            {
                var result = test_runner[check.type]( check.test );
                if ( result !== false ) return result;
            }
            return false;
        }

        var empty = function( obj )
        {
            for ( var name in obj ) return false;
            return true;
        }

        var forEachTest = function( callback )
        {
            for ( group in detect )
            {
                if ( detect.hasOwnProperty(group) )
                {
                    for ( test in detect[group].tests )
                    {
                        if ( detect[group].tests.hasOwnProperty(test) )
                        {
                            if ( callback( group, test ) === false ) return;
                        }
                    }
                }
            }
        }

        var addToResults = function( group, test, res )
        {

            results[group] = results[group] || {};
            results[group].results = results[group].results || {};

            results[group].description = detect[group].description;
            results[group].return_type = detect[group].return_type;

            results[group]['results'][test] = res;


            indexed_results[test.toLowerCase()] = res;
        }

        /* publicly available methods */

        sniff.results = function(){
            return results;
        };

        sniff.check = function( to_test )
        {
            to_test = to_test.toLowerCase();
            if ( indexed_results[to_test] != undefined ) return indexed_results[to_test];
            else {

                forEachTest(function( group, test ){

                    if ( test.toLowerCase() === to_test )
                    {
                        addToResults( group, test, run( detect[group].tests[test] ) );
                        return false; // break out of forEachTest loop
                    }

                });
            }
            return indexed_results[to_test];
        };

        sniff.run = function()
        {
            forEachTest(function( group, test ){

                addToResults( group, test, run( detect[group].tests[test] ) );

            });

            return sniff.results();
        };

        return sniff;

    })( window, document );

    var tim = (function(){
        var starts  = "{{",
            ends    = "}}",
            path    = "[a-z0-9_][\\.a-z0-9_]*", // e.g. config.person.name
            pattern = new RegExp(starts + "("+ path +")" + ends, "gim"),
            length  = "length",
            undef;

        return function(template, data){
            return template.replace(pattern, function(tag){
                var ref = tag.slice(starts[length], 0 - ends[length]),
                    path = ref.split("."),
                    len = path[length],
                    lookup = data,
                    i = 0;

                for (; i < len; i++){
                    if (lookup === undef){
                        break;
                    }
                    lookup = lookup[path[i]];

                    if (i === len - 1){
                        return lookup;
                    }
                }
            });
        };
    }());

/* Floodlight (X)HTML Syntax Highlighter - v0.1
 *  Copyright 2010, Aron Carroll
 *  Released under the MIT license
 *  More Information: http://github.com/aron/floodlight.js
 */

(function (window, undefined) {
	var options = {
		prefix: '',
		spaces: '  ',
		regex: {
			tag:     /(<\/?)(\w+)([^>]*)(\/?>)/gi,
			/* Attribute regex source: http://ejohn.org/blog/pure-javascript-html-parser/ */
			attr:    /(\w+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g,
			comment: /<!--[^\-]*-->/g,
			encode:  /<|>|"|&/g,
			decode:  /&(?:lt|gt|quot|amp);/g
		},
		map: {
			encode: {'<':'&lt;', '>':'&gt;', '"':'&quot;', '&':'&amp;'},
			decode: {'&lt;':'<', '&gt;':'>', '&quot;':'"', '&amp;':'&'}
		}
	};

	function parseTags(source) {
		return source.replace(/\t/g, options.spaces).replace(options.regex.tag,
			function (match, open, tag, attr, close) {
				return wrap(open, 'bracket') + wrap(tag, 'tag') + parseAttributes(attr) + wrap(close, 'bracket');
			}
		).replace(options.regex.comment, function (comment) {
			return wrap(comment, 'comment');
		});
	}

	function parseAttributes(attributes) {
		return attributes.replace(options.regex.attr, function (match, a, v1, v2, v3) {
			var value = (((v1 || v2) || v3) || '');
			return wrap(a, 'attribute') + '=' + wrap('"' + value + '"', 'value');
		});
	}

	function entities(string, type) {
		return string.replace(options.regex[type], function (match) {
			return options.map[type][match];
		});
	}

	function wrap(string, klass) {
		return '<span class="' + options.prefix + klass + '">' + entities(string, 'encode') + '</span>';
	}

	window.floodlight = parseTags;

	window.floodlight.encode  = function (string) { return entities(string, 'encode'); };
	window.floodlight.decode  = function (string) { return entities(string, 'decode'); };
	window.floodlight.options = options;
})(this);

    /*
     * 'snoopQuery' - mini jQuery-style DOM helper functions.
     * Only intended to work in newer browsers (eg. with querySelectorAll support),
     * VERY limited, not intended for extraction, only useful in a Snoopy-specific context
     * Methods should be ab API match for jQuery so that it could be dropped in as a replacement if necessary later on.
     */
    snoopQuery = function( selector )
    {
        return new snoopQuery.fn.init(selector);
    }

    snoopQuery.fn = snoopQuery.prototype = {

        length : 0,
        selector : '',

        init : function( selector )
        {
            var elem,
                tagExp = /^<(\w+)\s*\/?>(?:<\/\1>)?$/,
                match;

            if ( ! selector ) return this;

            if ( selector.nodeType )
            {
                this[0] = selector;
                this.length = 1;
                return this;
            }

            if ( selector === window )
            {
               this[0] = selector;
               this.length = 1;
               return this;
            }

            match = tagExp.exec(selector);

            if ( match )
            {
                selector = [doc.createElement(match[1])];
                merge( this, selector );
                return this;
            }
            else if ( /^#[\w+]$/.test( selector ) )
            {
                elem = doc.getElementById(selector);
                if ( elem )
                {
                    this.length = 1;
                    this[0] = elem;
                }
                this.selector = selector;
                this.context = document;
                return this;
            }
            else if ( /^\w+$/.test( selector ) )
            {
                this.selector = selector;
                this.context = document;
                selector = document.getElementsByTagName( selector );
                return merge( this, selector );
            }
            else if ( typeof selector === 'string' )
            {
                this.selector = selector;
                this.context = document;
                selector = document.querySelectorAll( selector );
                return merge( this, selector );
            }

            if (selector.selector !== undefined)
            {
                this.selector = selector.selector;
                this.context = selector.context;
            }

            return merge( selector, this );
        },

        each : function( callback )
        {
            var i = 0,
                length = this.length;

            for ( var value = this[0]; i < length && callback.call( value, i, value ) !== false; value = this[++i] ) {}
        },

        bind : function( event, callback )
        {
            for ( var i = 0, l = this.length; i < l; i++ )
            {
                this[i].addEventListener( event, function(e){
                    if ( callback.call(this, e) === false )
                    {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }, false );
            }
            return this;
        },

        addClass : function( value )
        {
            var cn = (value || '').split(/\s/);
            this.each(function(){
                for ( var i = 0, l = cn.length; i < l;  i++ )
                {
                    if ( ! snoopQuery(this).hasClass( cn[i] ) ) this.className += this.className ? ' '+cn[i] : cn[i];
                }
            });
            return this;
        },

        removeClass : function( value )
        {
            var cn = (value || '').split(/\s/);

            this.each(function(){
                for ( var i = 0, l = cn.length; i < l;  i++ )
                {
                    this.className = trim(this.className.replace( this.className.match(' '+cn[i]) ? ' '+ cn[i] : cn[i], '' ));
                }
            });
            return this;
        },

        hasClass : function( value )
        {
            return this[0] ? new RegExp('\\b'+value+'\\b').test(this[0].className) : false;
        },


        attr : function( key, val )
        {
            if ( val !== undefined )
            {
                this.each(function(){
                    this.setAttribute( key, val );
                });
                return this;
            }
            else
            {
                return this[0] ? this[0].getAttribute( key ) : null;
            }
        },

        html : function( html )
        {
            if ( html !== undefined )
            {
                this.each(function(){
                    this.innerHTML = html;
                });
                return this;
            }
            return this[0] ? this[0].innerHTML : null;
        },


        append : function( elem )
        {
            if ( elem !== undefined )
            {
                elem = elem[0] ? elem[0] : elem;
                this.each(function(){
                    this.appendChild(elem);
                });
                return this;
            }
        }

    };

    snoopQuery.fn.init.prototype = snoopQuery.fn;
    $ = snoopQuery;


    (function() {

        var styles_regexp = /([\w-]+)\s*:\s*([^;!]+)\s?(!\s?important?)?\s?[;|$]?/i;

        $.fn.style = function( prop, val, important )
        {
            if ( val !== undefined )
            {
                important = important || false;
                return this.each(function(){

                    var dconst_rules = [];

                    var self = $(this);
                    split(dconst_rules, self.attr('style')); // split up the rules
                    set(dconst_rules, prop, val, important);
                    self.attr('style', combine(dconst_rules) );
                });
            }
            else
            {
                var self = $(this[0]),
                    dconst_rules = [];

                split(dconst_rules, self.attr('style')); // split up the rules
                return get(dconst_rules, prop);
            }
        }

        function get( dconst_rules, prop )
        {
            for ( var rule, i = -1; rule = dconst_rules[++i]; )
            {
                if ( prop === rule.prop ) return rule.val;
            }
            return null;
        }

        function set( dconst_rules, prop, val, important )
        {
            prop = trim(prop);

            for ( var rule, i = -1; rule = dconst_rules[++i]; )
            {
                if ( prop === rule.prop )
                {
                    dconst_rules[i].val = val;
                    dconst_rules[i].important = important;
                    return;
                }
            }
            dconst_rules.push({ prop : prop, val : val, important : important });
        }

        function combine( dconst_rules )
        {
            var rule_string = '';
            for ( var rule, i = -1; rule = dconst_rules[++i]; )
            {
                rule_string += rule.prop + ' : '+ rule.val;
                if ( rule.important ) rule_string += ' !important';
                rule_string += ';';
            }
            return rule_string;
        }

        function split( dconst_rules, rule_string )
        {
            if ( typeof rule_string === 'string' )
            {
                var rules = rule_string.split(/;/);

                for ( i= 0, l = rules.length; i < l; i++ )
                {
                    var r = trim(rules[i]);
                    if ( r !== '' )
                    {
                        var match = r.match(styles_regexp);
                        dconst_rules.push({ prop : trim(match[1]), val : trim(match[2]), important : !! match[3] });
                    }
                }
            }
        }

    })();


    function ajax( options )
    {
        options = {
            type        : options.type          || 'GET',
            url         : options.url           || '',
            timeout     : options.timeout       || 5000,
            onComplete  : options.onComplete    || function(){},
            onError     : options.onError       || function(){},
            onSuccess   : options.onSuccess     || function(){},
            data        : options.data          || ''
        }

        var r    = new XMLHttpRequest(),
            done = false;

        r.open(options.type, options.url, true);

        setTimeout(function(){
            done = true;
        }, options.timeout);

        r.onreadystatechange = function()
        {
            if ( r.readyState == 4 && ! done )
            {
                if ( ajaxSuccess( r ) )
                {
                    options.onSuccess( ajaxData( r, options.type ) );
                }
                else
                {
                    options.onError();
                }

                options.onComplete();

                r = null;
            }
        }

        r.send();
    }

    function ajaxSuccess( r )
    {
        try {
            return ! r.status && location.protocol == "file:" ||
                ( r.status >= 200 && r.status < 300 ) ||
                r.status == 304 ||
                navigator.userAgent.indexOf("Safari") >= 0 && typeof r.status == 'undefined';
        } catch(e) {}
        return false;
    }

    function ajaxData( r, type )
    {
        var ct = r.getResponseHeader('content-type'),
            data = ! type && ct && ct.indexOf('xml') >= 0;

        data = type == 'xml' || data ? r.responseXML : r.responseText;
        if ( type == 'script' ) eval.call(window, data);
        return data;
    }

    function getViewportDimensions()
    {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        }
    }

    function prepSource( source )
    {
        return source.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;');
    }

    function trim(str)
    {
        return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function isArray( obj )
    {
        return toString.call(obj) === "[object Array]";
    }

    function merge( first, second )
    {
        var i = first.length,
            j = 0;

        if ( typeof second.length === "number" )
        {
            for ( var l = second.length; j < l; j++ )
            {
                first[i++] = second[j];
            }
        }
        else
        {
            while ( second[j] !== undefined )
            {
                first[i++] = second[j++];
            }
        }

        first.length = i;

        return first;
    }


    function hideURLBar()
    {
        setTimeout(function() {
            window.scrollTo(0, 1);
        }, 0);
    }

    snoopy.init(); /* kick things off... */

})( window, document );
