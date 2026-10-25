import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AdminDashboard from '../screens/instructor/AdminDashboard';
import ManageUsersScreen from '../screens/instructor/ManageUsersScreen';
import SettingsScreen from '../screens/auth/SettingsScreen';
import CourseListScreen from '../screens/instructor/CourseListScreen';
import CreateCourseScreen from '../screens/instructor/CreateCourseScreen';
import CourseDetailScreen from '../screens/instructor/CourseDetailScreen';
import AddTopicsScreen from '../screens/instructor/AddTopicsScreen';
import GenerationLogsScreen from '../screens/instructor/GenerationLogsScreen';
import StudentListScreen from '../screens/instructor/StudentListScreen';
import StudentDetailScreen from '../screens/instructor/StudentDetailScreen';
import CategoryManagementScreen from '../screens/instructor/CategoryManagementScreen';
import CertificateManagementScreen from '../screens/instructor/CertificateManagementScreen';
import FeedbackScreen from '../screens/instructor/FeedbackScreen';
import CourseFeedbackDetailScreen from '../screens/instructor/CourseFeedbackDetailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import CertificateVerificationScreen from '../screens/auth/CertificateVerificationScreen';
import NotificationsScreen from '../screens/auth/NotificationsScreen';
import NotificationDetailScreen from '../screens/auth/NotificationDetailScreen';
import DiscussionScreen from '../screens/auth/DiscussionScreen';
import DiscussionThreadScreen from '../screens/auth/DiscussionThreadScreen';
import BlogManagementScreen from '../screens/instructor/BlogManagementScreen';
import CreateEditBlogScreen from '../screens/instructor/CreateEditBlogScreen';
import BulkEmailScreen from '../screens/instructor/BulkEmailScreen';

const Stack = createStackNavigator();

const AdminNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Dashboard" component={AdminDashboard} />
      <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
      <Stack.Screen name="ManageInstructors" component={ManageUsersScreen} />
      <Stack.Screen name="Courses" component={CourseListScreen} />
      <Stack.Screen name="CreateCourse" component={CreateCourseScreen} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="AddTopics" component={AddTopicsScreen} />
      <Stack.Screen name="GenerationLogs" component={GenerationLogsScreen} />
      <Stack.Screen name="Students" component={StudentListScreen} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
      <Stack.Screen name="Categories" component={CategoryManagementScreen} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagementScreen} />
      <Stack.Screen name="CertificateManagement" component={CertificateManagementScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="CourseFeedbackDetail" component={CourseFeedbackDetailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
      <Stack.Screen name="BlogManagement" component={BlogManagementScreen} />
      <Stack.Screen name="CreateEditBlog" component={CreateEditBlogScreen} />
      <Stack.Screen name="Discussion" component={DiscussionScreen} />
      <Stack.Screen name="DiscussionThread" component={DiscussionThreadScreen} />
      <Stack.Screen name="BulkEmail" component={BulkEmailScreen} />
      <Stack.Screen name="Verify" component={CertificateVerificationScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
