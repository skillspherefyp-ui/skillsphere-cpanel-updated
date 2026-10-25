/**
 * Shared sidebar item definitions per role.
 * Must match exactly what each role's dashboard uses so the nav pill
 * stays consistent across all screens.
 */

export const getSidebarItems = (role) => {
  switch (role) {
    case 'admin':
      return [
        { label: 'Dashboard',         icon: 'grid-outline',             iconActive: 'grid',             route: 'Dashboard' },
        { label: 'Manage Instructors',icon: 'person-outline',           iconActive: 'person',           route: 'ManageInstructors' },
        { label: 'All Courses',       icon: 'book-outline',             iconActive: 'book',             route: 'Courses' },
        { label: 'All Students',      icon: 'school-outline',           iconActive: 'school',           route: 'Students' },
        { label: 'Categories',        icon: 'layers-outline',           iconActive: 'layers',           route: 'Categories' },
        { label: 'Certificates',      icon: 'ribbon-outline',           iconActive: 'ribbon',           route: 'CertificateManagement' },
        { label: 'Feedback',          icon: 'star-outline',             iconActive: 'star',             route: 'Feedback' },
        { label: 'Blog',              icon: 'newspaper-outline',        iconActive: 'newspaper',        route: 'BlogManagement' },
        { label: 'Community',         icon: 'chatbubbles-outline',      iconActive: 'chatbubbles',      route: 'Discussion' },
        { label: 'Send Email',        icon: 'mail-outline',             iconActive: 'mail',             route: 'BulkEmail' },
      ];

    case 'instructor':
      return [
        { label: 'Dashboard',         icon: 'grid-outline',             iconActive: 'grid',             route: 'Dashboard' },
        { label: 'Skill Categories',  icon: 'layers-outline',           iconActive: 'layers',           route: 'CategoryManagement' },
        { label: 'Manage Courses',    icon: 'book-outline',             iconActive: 'book',             route: 'Courses' },
        { label: 'Students',          icon: 'people-outline',           iconActive: 'people',           route: 'Students' },
        { label: 'Certificates',      icon: 'ribbon-outline',           iconActive: 'ribbon',           route: 'CertificateManagement' },
        { label: 'Feedback',          icon: 'chatbubbles-outline',      iconActive: 'chatbubbles',      route: 'Feedback' },
        { label: 'Community',         icon: 'people-outline',           iconActive: 'people',           route: 'Discussion' },
      ];

    default: // student
      return [
        { label: 'Dashboard',         icon: 'grid-outline',             iconActive: 'grid',             route: 'Dashboard' },
        { label: 'Browse Courses',    icon: 'library-outline',          iconActive: 'library',          route: 'Courses' },
        { label: 'My Learning',       icon: 'school-outline',           iconActive: 'school',           route: 'EnrolledCourses' },
        { label: 'AI Assistant',      icon: 'robot-outline',            iconActive: 'robot',            route: 'AITutor', iconLib: 'mci' },
        { label: 'Certificates',      icon: 'ribbon-outline',           iconActive: 'ribbon',           route: 'Certificates' },
        { label: 'Verify Cert',       icon: 'shield-checkmark-outline', iconActive: 'shield-checkmark', route: 'CertificateVerify' },
        { label: 'Reminders',         icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle', route: 'Todo' },
        { label: 'Community',         icon: 'chatbubbles-outline',      iconActive: 'chatbubbles',      route: 'Discussion' },
      ];
  }
};
