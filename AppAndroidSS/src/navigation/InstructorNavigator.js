import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import InstructorDashboard from '../screens/instructor/InstructorDashboard';
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
import SettingsScreen from '../screens/auth/SettingsScreen';
import CertificateVerificationScreen from '../screens/auth/CertificateVerificationScreen';
import ManageUsersScreen from '../screens/instructor/ManageUsersScreen';
import NotificationsScreen from '../screens/auth/NotificationsScreen';
import NotificationDetailScreen from '../screens/auth/NotificationDetailScreen';
import DiscussionScreen from '../screens/auth/DiscussionScreen';
import DiscussionThreadScreen from '../screens/auth/DiscussionThreadScreen';
import AICourseGeneratorScreen from '../screens/instructor/AICourseGeneratorScreen';
import AIAnalyticsDashboard from '../screens/instructor/AIAnalyticsDashboard';

const Stack = createStackNavigator();

const InstructorNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Dashboard" component={InstructorDashboard} />
      <Stack.Screen name="Courses" component={CourseListScreen} />
      <Stack.Screen name="Students" component={StudentListScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CreateCourse" component={CreateCourseScreen} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="AddTopics" component={AddTopicsScreen} />
      <Stack.Screen name="GenerationLogs" component={GenerationLogsScreen} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
      <Stack.Screen name="CertificateManagement" component={CertificateManagementScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="CourseFeedbackDetail" component={CourseFeedbackDetailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagementScreen} />
      <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
      <Stack.Screen name="Discussion" component={DiscussionScreen} />
      <Stack.Screen name="DiscussionThread" component={DiscussionThreadScreen} />
      <Stack.Screen name="Verify" component={CertificateVerificationScreen} />
      <Stack.Screen name="AICourseGenerator" component={AICourseGeneratorScreen} />
      <Stack.Screen name="AIAnalytics" component={AIAnalyticsDashboard} />
    </Stack.Navigator>
  );
};

export default InstructorNavigator;
