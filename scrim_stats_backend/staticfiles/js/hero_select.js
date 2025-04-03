// Hero selection with duplicate prevention
(function($) {
    'use strict';
    
    // Get all selected heroes excluding the specified element
    function getOtherSelectedHeroes($excluded) {
        var selected = [];
        $('.hero-select').not($excluded).each(function() {
            var val = $(this).val();
            if (val && val.trim() !== '') {
                selected.push(val.trim().toLowerCase());
            }
        });
        return selected;
    }
    
    function initHeroSelect() {
        console.log('Initializing hero select widgets');
        
        $('.hero-select').each(function() {
            var $input = $(this);
            
            // Initialize Select2
            $input.select2({
                ajax: {
                    url: '/api/hero-autocomplete/',
                    dataType: 'json',
                    delay: 250,
                    data: function(params) {
                        return { term: params.term || '' };
                    },
                    processResults: function(data) {
                        // Get heroes selected in other inputs
                        var selectedHeroes = getOtherSelectedHeroes($input);
                        console.log('Already selected heroes:', selectedHeroes);
                        
                        // Filter out already selected heroes
                        var filteredResults = data.results.filter(function(hero) {
                            return !selectedHeroes.includes(hero.text.toLowerCase());
                        });
                        
                        return { results: filteredResults };
                    },
                    cache: false
                },
                minimumInputLength: 1,
                placeholder: 'Start typing hero name...',
                allowClear: true,
                tags: false  // Don't allow custom entries
            });
            
            // When a selection changes, refresh all other dropdowns
            $input.on('change', function() {
                console.log('Hero selection changed:', $input.val());
                
                // Force refresh of other dropdowns if they're open
                $('.hero-select').not($input).each(function() {
                    var $other = $(this);
                    if ($other.data('select2') && $other.data('select2').isOpen()) {
                        $other.select2('close');
                        $other.select2('open');
                    }
                });
            });
        });
    }
    
    // Initialize on document ready
    $(document).ready(function() {
        console.log('Document ready, initializing hero select');
        initHeroSelect();
    });
    
    // Handle dynamically added forms
    $(document).on('formset:added', function() {
        console.log('New form added, re-initializing hero select');
        initHeroSelect();
    });
    
})(django.jQuery || jQuery); 