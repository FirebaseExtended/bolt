"use strict";
var bolt = require('../bolt');
var rulesSuite = bolt.rulesSuite;
var secrets = require('../../auth-secrets');
rulesSuite("RegExp", function (test) {
    test.database(secrets.APP, secrets.SECRET);
    test.rules('samples/regexp');
    test("SocialSecurity", function (rules) {
        rules
            .at('/ss')
            .write('000-00-0000')
            .succeeds("All zeros.")
            .write('123-45-6789')
            .succeeds("All numbers.")
            .write('000-0a-0000')
            .fails("Contains letter.")
            .write('000-00-00000')
            .fails("Too long.")
            .write('000-0-000')
            .fails("Too short.")
            .write('00000000')
            .fails("Missing dashes.");
    });
    test("IntegerString", function (rules) {
        rules
            .at('/integer')
            .write('0')
            .succeeds("Zero.")
            .write('123')
            .succeeds("Example.")
            .write('-123')
            .succeeds("Negative Example.")
            .write('--123')
            .fails("Double negative.")
            .write('')
            .fails("Empty string.")
            .write('a')
            .fails("Alphabetic.")
            .write(' 0')
            .fails("Has spaces.")
            .write('0.0')
            .fails("Has decimal.");
    });
    test("FloatString", function (rules) {
        rules
            .at('/float')
            .write('0.0')
            .succeeds("Zero.")
            .write('123.456')
            .succeeds("Fixed point number.")
            .write('-123.456')
            .succeeds("Negative ixed point number.")
            .write('.1')
            .succeeds("No leading digits.")
            .write('1.')
            .succeeds("No trailing digits.")
            .write('-.1')
            .succeeds("Negative fraction only.")
            .write('.')
            .fails("Just decimal point.")
            .write('0')
            .succeeds("Zero.")
            .write('')
            .fails("Empty string.")
            .write('a')
            .fails("Alphabetic.")
            .write(' 0')
            .fails("Has spaces.");
    });
    test("Integer", function (rules) {
        rules
            .at('/int')
            .write(0)
            .succeeds("Zero.")
            .write(0.0)
            .succeeds("Floating Zero.")
            .write(123)
            .succeeds("Example.")
            .write(-123)
            .succeeds("Negative example.")
            .write(1.1)
            .fails("No fractional part allowed.")
            .write('0')
            .fails("String.");
    });
    test("Alpha", function (rules) {
        rules
            .at('/alpha')
            .write('a')
            .succeeds("Alpha")
            .write('A')
            .succeeds("Alpha")
            .write("hello")
            .succeeds("Word.")
            .write("123")
            .fails("Numeric.")
            .write(1)
            .fails("Number.")
            .write(true)
            .fails("Boolean.")
            .write("hello, world")
            .fails("Non-alpha.");
    });
    test("Year", function (rules) {
        rules
            .at('/year')
            .write('2015')
            .succeeds("This year.")
            .write('1900')
            .succeeds("Earliest year.")
            .write('1999')
            .succeeds("Latest in 20th century.")
            .write('2099')
            .succeeds("Latest in 21th century.")
            .write('2015 ')
            .fails("Extra space.")
            .write('2100')
            .fails("Distant future.")
            .write(1960)
            .fails("Number.")
            .write('')
            .fails("Empty string.");
    });
    test("ISODate", function (rules) {
        rules
            .at('/date')
            .write('2015-11-20')
            .succeeds("Today.")
            .write('1900-01-01')
            .succeeds("Earliest date.")
            .write('2099-12-31')
            .succeeds("Latest date.")
            .write('1899-12-31')
            .fails("Too early date.")
            .write('2100-01-01')
            .fails("Too late date.")
            .write('')
            .fails("Empty string.");
    });
    test("Slug", function (rules) {
        rules
            .at('/slug')
            .write('this-is-a-slug')
            .succeeds("Typical slug text.")
            .write('numbers-2016-ok')
            .succeeds("Number are ok.")
            .write('double--hyphen')
            .fails("Double hyphen not ok.")
            .write('-leading-hyphen')
            .fails("Leading hyphen not ok.")
            .write('trailing-hyphen-')
            .fails("Trailing hyphen not ok.")
            .write('nohyphen')
            .fails("Must have at least one hyphen.")
            .write('no-Upper')
            .fails("No upper case.")
            .write('no-special&-char')
            .fails("No special characters.")
            .write('no spaces')
            .fails("No spaces allowed.");
    });
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvcmVnZXhwLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQWlCQSxJQUFPLElBQUksV0FBVyxTQUFTLENBQUMsQ0FBQztBQUNqQyxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ2pDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBRTVDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsVUFBUyxJQUFJO0lBQ2hDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBRTdCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxVQUFDLEtBQUs7UUFDM0IsS0FBSzthQUNGLEVBQUUsQ0FBQyxLQUFLLENBQUM7YUFDVCxLQUFLLENBQUMsYUFBYSxDQUFDO2FBQ3BCLFFBQVEsQ0FBQyxZQUFZLENBQUM7YUFFdEIsS0FBSyxDQUFDLGFBQWEsQ0FBQzthQUNwQixRQUFRLENBQUMsY0FBYyxDQUFDO2FBRXhCLEtBQUssQ0FBQyxhQUFhLENBQUM7YUFDcEIsS0FBSyxDQUFDLGtCQUFrQixDQUFDO2FBRXpCLEtBQUssQ0FBQyxjQUFjLENBQUM7YUFDckIsS0FBSyxDQUFDLFdBQVcsQ0FBQzthQUVsQixLQUFLLENBQUMsV0FBVyxDQUFDO2FBQ2xCLEtBQUssQ0FBQyxZQUFZLENBQUM7YUFFbkIsS0FBSyxDQUFDLFVBQVUsQ0FBQzthQUNqQixLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FDMUI7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxlQUFlLEVBQUUsVUFBQyxLQUFLO1FBQzFCLEtBQUs7YUFDRixFQUFFLENBQUMsVUFBVSxDQUFDO2FBQ2QsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLFFBQVEsQ0FBQyxPQUFPLENBQUM7YUFFakIsS0FBSyxDQUFDLEtBQUssQ0FBQzthQUNaLFFBQVEsQ0FBQyxVQUFVLENBQUM7YUFFcEIsS0FBSyxDQUFDLE1BQU0sQ0FBQzthQUNiLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQzthQUU3QixLQUFLLENBQUMsT0FBTyxDQUFDO2FBQ2QsS0FBSyxDQUFDLGtCQUFrQixDQUFDO2FBRXpCLEtBQUssQ0FBQyxFQUFFLENBQUM7YUFDVCxLQUFLLENBQUMsZUFBZSxDQUFDO2FBRXRCLEtBQUssQ0FBQyxHQUFHLENBQUM7YUFDVixLQUFLLENBQUMsYUFBYSxDQUFDO2FBRXBCLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxLQUFLLENBQUMsYUFBYSxDQUFDO2FBRXBCLEtBQUssQ0FBQyxLQUFLLENBQUM7YUFDWixLQUFLLENBQUMsY0FBYyxDQUFDLENBQ3ZCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQUMsS0FBSztRQUN4QixLQUFLO2FBQ0YsRUFBRSxDQUFDLFFBQVEsQ0FBQzthQUNaLEtBQUssQ0FBQyxLQUFLLENBQUM7YUFDWixRQUFRLENBQUMsT0FBTyxDQUFDO2FBRWpCLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDaEIsUUFBUSxDQUFDLHFCQUFxQixDQUFDO2FBRS9CLEtBQUssQ0FBQyxVQUFVLENBQUM7YUFDakIsUUFBUSxDQUFDLDZCQUE2QixDQUFDO2FBRXZDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxRQUFRLENBQUMsb0JBQW9CLENBQUM7YUFFOUIsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQzthQUUvQixLQUFLLENBQUMsS0FBSyxDQUFDO2FBQ1osUUFBUSxDQUFDLHlCQUF5QixDQUFDO2FBRW5DLEtBQUssQ0FBQyxHQUFHLENBQUM7YUFDVixLQUFLLENBQUMscUJBQXFCLENBQUM7YUFFNUIsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLFFBQVEsQ0FBQyxPQUFPLENBQUM7YUFFakIsS0FBSyxDQUFDLEVBQUUsQ0FBQzthQUNULEtBQUssQ0FBQyxlQUFlLENBQUM7YUFFdEIsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLEtBQUssQ0FBQyxhQUFhLENBQUM7YUFFcEIsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FDdEI7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxTQUFTLEVBQUUsVUFBQyxLQUFLO1FBQ3BCLEtBQUs7YUFDRixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ1YsS0FBSyxDQUFDLENBQUMsQ0FBQzthQUNSLFFBQVEsQ0FBQyxPQUFPLENBQUM7YUFFakIsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQzthQUUxQixLQUFLLENBQUMsR0FBRyxDQUFDO2FBQ1YsUUFBUSxDQUFDLFVBQVUsQ0FBQzthQUVwQixLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7YUFDWCxRQUFRLENBQUMsbUJBQW1CLENBQUM7YUFFN0IsS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNWLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQzthQUVwQyxLQUFLLENBQUMsR0FBRyxDQUFDO2FBQ1YsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUNsQjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFDLEtBQUs7UUFDbEIsS0FBSzthQUNGLEVBQUUsQ0FBQyxRQUFRLENBQUM7YUFDWixLQUFLLENBQUMsR0FBRyxDQUFDO2FBQ1YsUUFBUSxDQUFDLE9BQU8sQ0FBQzthQUVqQixLQUFLLENBQUMsR0FBRyxDQUFDO2FBQ1YsUUFBUSxDQUFDLE9BQU8sQ0FBQzthQUVqQixLQUFLLENBQUMsT0FBTyxDQUFDO2FBQ2QsUUFBUSxDQUFDLE9BQU8sQ0FBQzthQUVqQixLQUFLLENBQUMsS0FBSyxDQUFDO2FBQ1osS0FBSyxDQUFDLFVBQVUsQ0FBQzthQUVqQixLQUFLLENBQUMsQ0FBQyxDQUFDO2FBQ1IsS0FBSyxDQUFDLFNBQVMsQ0FBQzthQUVoQixLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsS0FBSyxDQUFDLFVBQVUsQ0FBQzthQUVqQixLQUFLLENBQUMsY0FBYyxDQUFDO2FBQ3JCLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FDckI7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxNQUFNLEVBQUUsVUFBQyxLQUFLO1FBQ2pCLEtBQUs7YUFDRixFQUFFLENBQUMsT0FBTyxDQUFDO2FBQ1gsS0FBSyxDQUFDLE1BQU0sQ0FBQzthQUNiLFFBQVEsQ0FBQyxZQUFZLENBQUM7YUFFdEIsS0FBSyxDQUFDLE1BQU0sQ0FBQzthQUNiLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQzthQUUxQixLQUFLLENBQUMsTUFBTSxDQUFDO2FBQ2IsUUFBUSxDQUFDLHlCQUF5QixDQUFDO2FBRW5DLEtBQUssQ0FBQyxNQUFNLENBQUM7YUFDYixRQUFRLENBQUMseUJBQXlCLENBQUM7YUFFbkMsS0FBSyxDQUFDLE9BQU8sQ0FBQzthQUNkLEtBQUssQ0FBQyxjQUFjLENBQUM7YUFFckIsS0FBSyxDQUFDLE1BQU0sQ0FBQzthQUNiLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQzthQUV4QixLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsS0FBSyxDQUFDLFNBQVMsQ0FBQzthQUVoQixLQUFLLENBQUMsRUFBRSxDQUFDO2FBQ1QsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUN4QjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLFNBQVMsRUFBRSxVQUFDLEtBQUs7UUFDcEIsS0FBSzthQUNGLEVBQUUsQ0FBQyxPQUFPLENBQUM7YUFDWCxLQUFLLENBQUMsWUFBWSxDQUFDO2FBQ25CLFFBQVEsQ0FBQyxRQUFRLENBQUM7YUFFbEIsS0FBSyxDQUFDLFlBQVksQ0FBQzthQUNuQixRQUFRLENBQUMsZ0JBQWdCLENBQUM7YUFFMUIsS0FBSyxDQUFDLFlBQVksQ0FBQzthQUNuQixRQUFRLENBQUMsY0FBYyxDQUFDO2FBRXhCLEtBQUssQ0FBQyxZQUFZLENBQUM7YUFDbkIsS0FBSyxDQUFDLGlCQUFpQixDQUFDO2FBRXhCLEtBQUssQ0FBQyxZQUFZLENBQUM7YUFDbkIsS0FBSyxDQUFDLGdCQUFnQixDQUFDO2FBRXZCLEtBQUssQ0FBQyxFQUFFLENBQUM7YUFDVCxLQUFLLENBQUMsZUFBZSxDQUFDLENBQ3hCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsTUFBTSxFQUFFLFVBQUMsS0FBSztRQUNqQixLQUFLO2FBQ0YsRUFBRSxDQUFDLE9BQU8sQ0FBQzthQUNYLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQzthQUN2QixRQUFRLENBQUMsb0JBQW9CLENBQUM7YUFFOUIsS0FBSyxDQUFDLGlCQUFpQixDQUFDO2FBQ3hCLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQzthQUUxQixLQUFLLENBQUMsZ0JBQWdCLENBQUM7YUFDdkIsS0FBSyxDQUFDLHVCQUF1QixDQUFDO2FBRTlCLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQzthQUN4QixLQUFLLENBQUMsd0JBQXdCLENBQUM7YUFFL0IsS0FBSyxDQUFDLGtCQUFrQixDQUFDO2FBQ3pCLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQzthQUVoQyxLQUFLLENBQUMsVUFBVSxDQUFDO2FBQ2pCLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQzthQUV2QyxLQUFLLENBQUMsVUFBVSxDQUFDO2FBQ2pCLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQzthQUV2QixLQUFLLENBQUMsa0JBQWtCLENBQUM7YUFDekIsS0FBSyxDQUFDLHdCQUF3QixDQUFDO2FBRS9CLEtBQUssQ0FBQyxXQUFXLENBQUM7YUFDbEIsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQzdCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L3JlZ2V4cC10ZXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cclxuICpcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcclxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxyXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcclxuICpcclxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqL1xyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9ub2RlLmQudHNcIiAvPlxyXG5cclxuaW1wb3J0IGJvbHQgPSByZXF1aXJlKCcuLi9ib2x0Jyk7XHJcbnZhciBydWxlc1N1aXRlID0gYm9sdC5ydWxlc1N1aXRlO1xyXG52YXIgc2VjcmV0cyA9IHJlcXVpcmUoJy4uLy4uL2F1dGgtc2VjcmV0cycpO1xyXG5cclxucnVsZXNTdWl0ZShcIlJlZ0V4cFwiLCBmdW5jdGlvbih0ZXN0KSB7XHJcbiAgdGVzdC5kYXRhYmFzZShzZWNyZXRzLkFQUCwgc2VjcmV0cy5TRUNSRVQpO1xyXG4gIHRlc3QucnVsZXMoJ3NhbXBsZXMvcmVnZXhwJyk7XHJcblxyXG4gIHRlc3QoXCJTb2NpYWxTZWN1cml0eVwiLCAocnVsZXMpID0+IHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hdCgnL3NzJylcclxuICAgICAgLndyaXRlKCcwMDAtMDAtMDAwMCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkFsbCB6ZXJvcy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMTIzLTQ1LTY3ODknKVxyXG4gICAgICAuc3VjY2VlZHMoXCJBbGwgbnVtYmVycy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMDAwLTBhLTAwMDAnKVxyXG4gICAgICAuZmFpbHMoXCJDb250YWlucyBsZXR0ZXIuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzAwMC0wMC0wMDAwMCcpXHJcbiAgICAgIC5mYWlscyhcIlRvbyBsb25nLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcwMDAtMC0wMDAnKVxyXG4gICAgICAuZmFpbHMoXCJUb28gc2hvcnQuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzAwMDAwMDAwJylcclxuICAgICAgLmZhaWxzKFwiTWlzc2luZyBkYXNoZXMuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJJbnRlZ2VyU3RyaW5nXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcvaW50ZWdlcicpXHJcbiAgICAgIC53cml0ZSgnMCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIlplcm8uXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzEyMycpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkV4YW1wbGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJy0xMjMnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJOZWdhdGl2ZSBFeGFtcGxlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCctLTEyMycpXHJcbiAgICAgIC5mYWlscyhcIkRvdWJsZSBuZWdhdGl2ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnJylcclxuICAgICAgLmZhaWxzKFwiRW1wdHkgc3RyaW5nLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCdhJylcclxuICAgICAgLmZhaWxzKFwiQWxwaGFiZXRpYy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnIDAnKVxyXG4gICAgICAuZmFpbHMoXCJIYXMgc3BhY2VzLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcwLjAnKVxyXG4gICAgICAuZmFpbHMoXCJIYXMgZGVjaW1hbC5cIilcclxuICAgIDtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcIkZsb2F0U3RyaW5nXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcvZmxvYXQnKVxyXG4gICAgICAud3JpdGUoJzAuMCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIlplcm8uXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzEyMy40NTYnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJGaXhlZCBwb2ludCBudW1iZXIuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJy0xMjMuNDU2JylcclxuICAgICAgLnN1Y2NlZWRzKFwiTmVnYXRpdmUgaXhlZCBwb2ludCBudW1iZXIuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJy4xJylcclxuICAgICAgLnN1Y2NlZWRzKFwiTm8gbGVhZGluZyBkaWdpdHMuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzEuJylcclxuICAgICAgLnN1Y2NlZWRzKFwiTm8gdHJhaWxpbmcgZGlnaXRzLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCctLjEnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJOZWdhdGl2ZSBmcmFjdGlvbiBvbmx5LlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcuJylcclxuICAgICAgLmZhaWxzKFwiSnVzdCBkZWNpbWFsIHBvaW50LlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcwJylcclxuICAgICAgLnN1Y2NlZWRzKFwiWmVyby5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnJylcclxuICAgICAgLmZhaWxzKFwiRW1wdHkgc3RyaW5nLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCdhJylcclxuICAgICAgLmZhaWxzKFwiQWxwaGFiZXRpYy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnIDAnKVxyXG4gICAgICAuZmFpbHMoXCJIYXMgc3BhY2VzLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiSW50ZWdlclwiLCAocnVsZXMpID0+IHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hdCgnL2ludCcpXHJcbiAgICAgIC53cml0ZSgwKVxyXG4gICAgICAuc3VjY2VlZHMoXCJaZXJvLlwiKVxyXG5cclxuICAgICAgLndyaXRlKDAuMClcclxuICAgICAgLnN1Y2NlZWRzKFwiRmxvYXRpbmcgWmVyby5cIilcclxuXHJcbiAgICAgIC53cml0ZSgxMjMpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkV4YW1wbGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoLTEyMylcclxuICAgICAgLnN1Y2NlZWRzKFwiTmVnYXRpdmUgZXhhbXBsZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgxLjEpXHJcbiAgICAgIC5mYWlscyhcIk5vIGZyYWN0aW9uYWwgcGFydCBhbGxvd2VkLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcwJylcclxuICAgICAgLmZhaWxzKFwiU3RyaW5nLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiQWxwaGFcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9hbHBoYScpXHJcbiAgICAgIC53cml0ZSgnYScpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkFscGhhXCIpXHJcblxyXG4gICAgICAud3JpdGUoJ0EnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJBbHBoYVwiKVxyXG5cclxuICAgICAgLndyaXRlKFwiaGVsbG9cIilcclxuICAgICAgLnN1Y2NlZWRzKFwiV29yZC5cIilcclxuXHJcbiAgICAgIC53cml0ZShcIjEyM1wiKVxyXG4gICAgICAuZmFpbHMoXCJOdW1lcmljLlwiKVxyXG5cclxuICAgICAgLndyaXRlKDEpXHJcbiAgICAgIC5mYWlscyhcIk51bWJlci5cIilcclxuXHJcbiAgICAgIC53cml0ZSh0cnVlKVxyXG4gICAgICAuZmFpbHMoXCJCb29sZWFuLlwiKVxyXG5cclxuICAgICAgLndyaXRlKFwiaGVsbG8sIHdvcmxkXCIpXHJcbiAgICAgIC5mYWlscyhcIk5vbi1hbHBoYS5cIilcclxuICAgIDtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcIlllYXJcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy95ZWFyJylcclxuICAgICAgLndyaXRlKCcyMDE1JylcclxuICAgICAgLnN1Y2NlZWRzKFwiVGhpcyB5ZWFyLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcxOTAwJylcclxuICAgICAgLnN1Y2NlZWRzKFwiRWFybGllc3QgeWVhci5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMTk5OScpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkxhdGVzdCBpbiAyMHRoIGNlbnR1cnkuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzIwOTknKVxyXG4gICAgICAuc3VjY2VlZHMoXCJMYXRlc3QgaW4gMjF0aCBjZW50dXJ5LlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcyMDE1ICcpXHJcbiAgICAgIC5mYWlscyhcIkV4dHJhIHNwYWNlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcyMTAwJylcclxuICAgICAgLmZhaWxzKFwiRGlzdGFudCBmdXR1cmUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoMTk2MClcclxuICAgICAgLmZhaWxzKFwiTnVtYmVyLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcnKVxyXG4gICAgICAuZmFpbHMoXCJFbXB0eSBzdHJpbmcuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJJU09EYXRlXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcvZGF0ZScpXHJcbiAgICAgIC53cml0ZSgnMjAxNS0xMS0yMCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIlRvZGF5LlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcxOTAwLTAxLTAxJylcclxuICAgICAgLnN1Y2NlZWRzKFwiRWFybGllc3QgZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMjA5OS0xMi0zMScpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkxhdGVzdCBkYXRlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcxODk5LTEyLTMxJylcclxuICAgICAgLmZhaWxzKFwiVG9vIGVhcmx5IGRhdGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzIxMDAtMDEtMDEnKVxyXG4gICAgICAuZmFpbHMoXCJUb28gbGF0ZSBkYXRlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcnKVxyXG4gICAgICAuZmFpbHMoXCJFbXB0eSBzdHJpbmcuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJTbHVnXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcvc2x1ZycpXHJcbiAgICAgIC53cml0ZSgndGhpcy1pcy1hLXNsdWcnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJUeXBpY2FsIHNsdWcgdGV4dC5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnbnVtYmVycy0yMDE2LW9rJylcclxuICAgICAgLnN1Y2NlZWRzKFwiTnVtYmVyIGFyZSBvay5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnZG91YmxlLS1oeXBoZW4nKVxyXG4gICAgICAuZmFpbHMoXCJEb3VibGUgaHlwaGVuIG5vdCBvay5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnLWxlYWRpbmctaHlwaGVuJylcclxuICAgICAgLmZhaWxzKFwiTGVhZGluZyBoeXBoZW4gbm90IG9rLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCd0cmFpbGluZy1oeXBoZW4tJylcclxuICAgICAgLmZhaWxzKFwiVHJhaWxpbmcgaHlwaGVuIG5vdCBvay5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnbm9oeXBoZW4nKVxyXG4gICAgICAuZmFpbHMoXCJNdXN0IGhhdmUgYXQgbGVhc3Qgb25lIGh5cGhlbi5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnbm8tVXBwZXInKVxyXG4gICAgICAuZmFpbHMoXCJObyB1cHBlciBjYXNlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCduby1zcGVjaWFsJi1jaGFyJylcclxuICAgICAgLmZhaWxzKFwiTm8gc3BlY2lhbCBjaGFyYWN0ZXJzLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCdubyBzcGFjZXMnKVxyXG4gICAgICAuZmFpbHMoXCJObyBzcGFjZXMgYWxsb3dlZC5cIilcclxuICAgIDtcclxuICB9KTtcclxufSk7XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
