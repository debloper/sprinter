// Controllers ----------------------------------------------------------------

angular.module('myApp.controllers', [])
  .controller('topCtrl', [
    '$scope',
    '$rootScope',
    '$http',
    'sprintService',
    'authService',
    'config',
    function ($scope, $rootScope, $http, sprintService, authService, config) {
      authService.getUser();
      $scope.login = authService.login;
      $scope.logout = authService.logout;
      $scope.$on('sprintRefresh', function (event, sprints) {
        $scope.sprints = sprints;
      });
    }
  ])
  .controller('sidebarCtrl', [
    '$scope',
    '$http',
    '$rootScope',
    'sprintService',
    'config',
    function ($scope, $http, $rootScope, sprintService, config) {

      $scope.$on('sprintRefresh', function (event, sprints) {
        $scope.sprints = sprints;
      });
      sprintService.refresh();

    }
  ])
  .controller('HomeCtrl', ['$scope', '$http', 'localStorageService',
    function ($scope, $http, localStorageService) {
      $scope.flagList = function (flags) {
        return flags.map(function (flag) {
          return flag.setter;
        }).join(', ');
      };

      $scope.bugzillaEmail = localStorageService.get('bugzilla_email');

      $scope.$watch('bugzillaEmail', function() {
        localStorageService.set('bugzilla_email', $scope.bugzillaEmail);
      });

      $scope.onEmailChange = function (email) {
         $http({
            method: 'GET',
            url: '/flags',
            params: {
              user: email
            }
          })
          .success(function (data) {
            console.log(data);
            $scope.flags = data;
          });
      };

      // Init
      $scope.onEmailChange($scope.bugzillaEmail);
    }
  ])
  .controller('AddCtrl', ['$scope', '$http', 'moment', 'sprintService',
    function($scope, $http, moment, sprintService) {

      $scope.pageTitle = 'Add Sprint';
      $scope.submitLabel = 'Create sprint';

      // The default dueDate should be today

      function reset() {
        $scope.new = {
          dueDate: moment().day('Friday').toDate()
        };
      }

      reset();

      $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
      };

      $scope.dateOptions = {
         'year-format': "'yy'",
         'show-weeks': false
       };

       $scope.submit = function() {

        // Set the time of the due date to 4:00PM Eastern, which is when our demos are
        $scope.new.dueDate = moment($scope.new.dueDate).hour(16).startOf('hour').toDate();

        $http
          .post('/api/sprint', $scope.new)
          .success(function(data) {
            reset();
            sprintService.refresh();
          })
          .error(function(err) {
            console.log(err);
          });
       };

       $scope.activeTab = 'bugzilla';

    }
  ])
.controller('UpdateCtrl', ['$scope', '$http', '$routeParams', '$location', 'moment', 'sprintService',
  function($scope, $http, $routeParams, $location, moment, sprintService) {

    $scope.pageTitle = 'Edit Sprint';
    $scope.submitLabel = 'Update sprint';

    sprintService
      .getSprint($routeParams.id)
      .success(function (data) {
        $scope.new = data;
      });

    $scope.cancel = function () {
      $location.path('/sprint/' + $routeParams.id);
    };

    $scope.open = function($event) {
      $event.preventDefault();
      $event.stopPropagation();
      $scope.opened = true;
    };

    $scope.dateOptions = {
       'year-format': "'yy'",
       'show-weeks': false
     };

     $scope.submit = function() {
      $http
        .put('/api/sprint/' + $routeParams.id, $scope.new)
        .success(function(data) {
          sprintService.refresh();
          $location.path('/sprint/' + $routeParams.id);
        })
        .error(function(err) {
          console.log(err);
        });
     };

     $scope.activeTab = 'bugzilla';

  }
])
  .controller('SprintCtrl', ['$scope', '$http', '$rootScope', '$routeParams', 'sprintService', 'bzService',

    function($scope, $http, $rootScope, $routeParams, sprintService, bzService) {

      $scope.m = {};
      $scope.bugs = [];
      $scope.complete = {};

      $scope.archive = sprintService.archive($routeParams.id, function (data) {
        $scope.m = data
      });


      $scope.getBugs = function() {
        $scope.bugs = [];
        bzService.getBugs($scope.m.whiteboard, function (data) {
          $scope.bugs = data;
        });
      };

      sprintService
        .getSprint($routeParams.id)
        .success(function(data) {
          $scope.m = data;
          $rootScope.title = data.title;
          $scope.getBugs();
          $scope.newBugUrl = sprintService.newBugUrl(data.whiteboard, data.defaultComponent);
        });

      $scope.fields = [
        {
          name: 'Updated',
          bz: 'last_change_time'
        },
        {
          name: 'ID',
          bz: 'id'
        },
        {
          name: 'Bug',
          bz: 'summary'
        },
        {
          name: 'Whiteboard',
          bz: 'whiteboard',
          class: 'visible-lg'
        },
        {
          name: 'Assigned',
          bz: 'assigned_to_detail.real_name'
        },
        {
          name: 'Status',
          bz: 'status'
        }
      ];

      var asc = '';
      var desc = '-';

      function switchDir(dir) {
        return dir === '-' ? '' : '-';
      }

      $scope.orderDir = desc;
      $scope.orderByField = 'last_change_time';
      $scope.orderByFields = ['status', $scope.orderDir + $scope.orderByField, '-assignedTo'];

      $scope.setOrderBy = function(field) {
        $scope.orderByFields = [];
        if (field === $scope.orderByField) {
          $scope.orderDir = switchDir($scope.orderDir);
        } else {
          $scope.orderByField = field;
          if (field === 'last_change_time') {
            $scope.orderDir = desc;
          } else {
            $scope.orderDir = asc;
          }
        }

        if (field !== 'status') {
          $scope.orderByFields.push('status');
        }
        $scope.orderByFields.push($scope.orderDir + $scope.orderByField);
        if ($scope.orderByField !== 'assignedTo') {
          $scope.orderByFields.push('-assignedTo');
        }
      };

      function isResolved(bug) {
        return bug.status === 'RESOLVED';
      }

      $scope.$watch('bugs', function() {
        var bugsResolved = Math.floor($scope.bugs.filter(isResolved).length);
        var totalBugs =  $scope.bugs.length;
        $scope.complete = {
          percentage:  Math.round(bugsResolved / totalBugs * 100),
          resolved: bugsResolved,
          total: totalBugs
        };
        if ($scope.complete.percentage === 100) {
          $scope.hideResolved = false;
        }
      });

    }
  ])
  .controller('ArchivedCtrl', [
    '$scope',
    'sprintService',
    function ($scope, sprintService) {
      sprintService
        .getArchived()
        .success(function (sprints) {
          $scope.sprints = sprints;
        });
    }
  ]);
